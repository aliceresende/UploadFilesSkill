const { ComponentDialog, WaterfallDialog } = require('botbuilder-dialogs');
const { MessageFactory } = require('botbuilder');
const { BlobServiceClient } = require('@azure/storage-blob');
const { Readable } = require('stream');
const axios = require('axios');

class FileUploaderDialog extends ComponentDialog {
    constructor(id) {
        super(id || 'fileUploaderDialog');
        this.addDialog(new WaterfallDialog('waterfallDialog', [
            this.initiateProcess.bind(this),
            this.downloadAndUploadFile.bind(this),
            this.finalStep.bind(this)
        ]));
        this.initialDialogId = 'waterfallDialog';
        this.blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    }

    async initiateProcess(stepContext) {
        if (stepContext.context.activity.attachments && stepContext.context.activity.attachments.length > 0) {
            return await stepContext.next(stepContext.context.activity.attachments[0]);
        } else {
            await stepContext.context.sendActivity('Please upload a file to process.');
            return await stepContext.endDialog();
        }
    }

    async downloadAndUploadFile(stepContext) {
        const attachment = stepContext.result;
        if (!attachment) {
            await stepContext.context.sendActivity('No attachment found.');
            return stepContext.endDialog();
        }

        if (attachment.contentType === 'application/vnd.microsoft.teams.file.download.info') {
            return await this.processTeamsFile(stepContext, attachment);
        } else {
            return await this.processLocalFile(stepContext, attachment);
        }
    }

    async processTeamsFile(stepContext, attachment) {
        const downloadInfo = attachment.content;
        const response = await axios.get(downloadInfo.downloadUrl, { responseType: 'arraybuffer' });
        return this.uploadFile(stepContext, response.data, attachment.name);
    }

    async processLocalFile(stepContext, attachment) {
        const response = await axios.get(attachment.contentUrl, { responseType: 'arraybuffer' });
        return this.uploadFile(stepContext, response.data, attachment.name);
    }

    async uploadFile(stepContext, fileData, fileName) {
        const fileStream = this.bufferToStream(fileData);
        const containerClient = this.blobServiceClient.getContainerClient('uploadithelper');
        const blockBlobClient = containerClient.getBlockBlobClient(fileName || "uploadithelper");
        await blockBlobClient.uploadStream(fileStream);
        return stepContext.next(blockBlobClient.url);
    }

    async finalStep(stepContext) {
        const fileUrl = stepContext.result;
        if (fileUrl) {
            const message = `Here is the URL of the uploaded file: ${fileUrl}`;
            await stepContext.context.sendActivity(message);
            // Limpa o estado da conversa
            await this.cancelAndClearConversation(stepContext);
            return await stepContext.endDialog(fileUrl);
        } else {
            await stepContext.context.sendActivity('Failed to upload file.');
            // Limpa o estado da conversa
            await this.cancelAndClearConversation(stepContext);
            return await stepContext.endDialog();
        }
    }
    
    async cancelAndClearConversation(stepContext) {
        // Cancela todos os diálogos na pilha
        await stepContext.cancelAllDialogs();
        // Limpa ou redefine o estado da conversação
        await this.conversationState.clear(stepContext.context);
    }
    
    bufferToStream(buffer) {
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);  // Indicates the end of the stream
        return stream;
    }
}

module.exports.FileUploaderDialog = FileUploaderDialog;
