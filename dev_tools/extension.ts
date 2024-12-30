import * as vscode from 'vscode';
import { VSCodeAPIManager } from './vscode_api_manager';

export function activate(context: vscode.ExtensionContext) {
    const apiManager = VSCodeAPIManager.getInstance(context);

    // Register command to make API calls
    let disposable = vscode.commands.registerCommand('aiPlatform.makeAPICall', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const selection = editor.selection;
            const text = editor.document.getText(selection);

            if (!text) {
                vscode.window.showWarningMessage('Please select text to process');
                return;
            }

            const response = await apiManager.callWithCache(text);
            
            // Insert response at cursor position
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, response.content[0]);
            });

        } catch (error: any) {
            vscode.window.showErrorMessage(`API call failed: ${error.message}`);
        }
    });

    // Register command for batch processing
    let batchDisposable = vscode.commands.registerCommand('aiPlatform.batchProcess', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            // Get all selections (supports multi-cursor)
            const selections = editor.selections;
            const texts = selections.map(selection => 
                editor.document.getText(selection)
            ).filter(text => text.length > 0);

            if (texts.length === 0) {
                vscode.window.showWarningMessage('Please select text to process');
                return;
            }

            const responses = await apiManager.batchProcess(texts);
            
            // Replace each selection with its processed result
            await editor.edit(editBuilder => {
                selections.forEach((selection, index) => {
                    if (responses[index]) {
                        editBuilder.replace(selection, responses[index].content[0]);
                    }
                });
            });

        } catch (error: any) {
            vscode.window.showErrorMessage(`Batch processing failed: ${error.message}`);
        }
    });

    // Add status bar controls
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.command = 'aiPlatform.makeAPICall';
    statusBarItem.text = '$(symbol-interface) AI Platform';
    statusBarItem.tooltip = 'Click to process selected text';
    statusBarItem.show();

    // Register configuration change handler
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('aiPlatform')) {
                // Reload configuration
                const config = vscode.workspace.getConfiguration('aiPlatform');
                process.env.ANTHROPIC_API_KEY = config.get('apiKey');
            }
        })
    );

    // Add to subscriptions
    context.subscriptions.push(disposable);
    context.subscriptions.push(batchDisposable);
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(apiManager);
}

export function deactivate() {
    // Cleanup
}
