const { ActivityHandler, ConversationState } = require('botbuilder');
const { DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');

class SkillBot extends ActivityHandler {
    /**
     * @param {ConversationState} conversationState
     * @param {Dialog} dialog
     */
    constructor(conversationState, dialog) {
        super();
        if (!conversationState) {
            throw new Error('[SkillBot]: Missing parameter. conversationState is required');
        }
        if (!dialog) {
            throw new Error('[SkillBot]: Missing parameter. dialog is required');
        }

        this.conversationState = conversationState;
        this.dialog = dialog;

        this.onTurn(async (context, next) => {
            const dialogs = new DialogSet(this.conversationState.createProperty('DialogState'));
            dialogs.add(this.dialog);

            const dc = await dialogs.createContext(context);

            if (context.activity.type === 'message') {
                // Continue the current dialog
                const results = await dc.continueDialog();
                if (results.status === DialogTurnStatus.empty) {
                    // If no dialog is active, start a new dialog
                    await dc.beginDialog(this.dialog.id);
                }
            } else {
                console.log('Received non-message activity type');
            }

            await next();
        });
    }

    /**
     * Override the ActivityHandler.run() method to save state changes after the bot logic completes.
     */
    async run(context) {
        await super.run(context);
        await this.conversationState.saveChanges(context, false);
    }
}

module.exports.SkillBot = SkillBot;
