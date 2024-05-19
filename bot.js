const axios = require('axios');
const { ActivityHandler, MessageFactory, CardFactory } = require('botbuilder');
const { BlobServiceClient } = require('@azure/storage-blob');
const { Readable } = require('stream');

class EchoBot extends ActivityHandler {
    constructor() {
        super();
        this.blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
       
        this.onMessage(async (context, next) => {
            console.log('Received attachments:', context.activity.attachments);

            if (context.activity.attachments && context.activity.attachments.length > 0) {
                const attachment = context.activity.attachments[0];
                console.log('Processing attachment:', attachment);

                if (attachment.contentType === 'application/vnd.microsoft.teams.file.download.info') {
                    const downloadInfo = attachment.content;
                    console.log('Download info:', downloadInfo);

                    if (downloadInfo.downloadUrl) {
                        try {
                            const fileResult = await this.downloadAndUploadFile(downloadInfo.downloadUrl, attachment.name || "uploadithelper", context);
                            if (fileResult && fileResult.url) {
                                const reply = MessageFactory.text(`Here is the URL of the uploaded file: ${fileResult.url}`);
                                reply.value = { url: fileResult.url };  // Add URL in the value field of the activity
                                await context.sendActivity(reply);
                            } else {
                                await context.sendActivity('Failed to upload file.');
                            }
                            
                        } catch (error) {
                            console.error('Error processing download and upload:', error);
                            await context.sendActivity(`Error while processing the file: ${error.message}`);
                        }
                        await context.sendActivity({ type: 'endOfConversation' });
                    } else {
                        console.error('Invalid download URL:', downloadInfo);
                        await context.sendActivity('The attachment does not have a valid download URL.');
                    }
                } else {
                    console.error('Unsupported file type:', attachment.contentType);
                    await context.sendActivity('Unsupported file type.');
                }
            } else {
                console.log('No attachments received.');
                await context.sendActivity('No attachment found. Please send any file type.');
            }
            await next();
        });
    }

    async downloadAndUploadFile(downloadUrl, fileName, context) {
        try {
            console.log(`Downloading file from ${downloadUrl}`);
            const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
            const fileBuffer = Buffer.from(response.data, 'binary');
            const fileStream = bufferToStream(fileBuffer);

            const containerClient = this.blobServiceClient.getContainerClient('uploadithelper');
            const blockBlobClient = containerClient.getBlockBlobClient(fileName);

            console.log(`Uploading file to Blob storage: ${fileName}`);
            await blockBlobClient.uploadStream(fileStream);
            console.log('Upload successful:', blockBlobClient.url);

            return { url: blockBlobClient.url };
        } catch (error) {
            console.error('Error downloading or uploading file:', error);
            throw new Error(`Failed to download or upload: ${error.message}`);
        }
    }
}

function bufferToStream(buffer) {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);  // Indicates the end of the stream
    return stream;
}

module.exports.EchoBot = EchoBot;
