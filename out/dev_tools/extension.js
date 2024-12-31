"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const vscode_api_manager_1 = require("./vscode_api_manager");
function activate(context) {
    const apiManager = vscode_api_manager_1.VSCodeAPIManager.getInstance(context);
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
        }
        catch (error) {
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
            const texts = selections.map(selection => editor.document.getText(selection)).filter(text => text.length > 0);
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
        }
        catch (error) {
            vscode.window.showErrorMessage(`Batch processing failed: ${error.message}`);
        }
    });
    // Add status bar controls
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'aiPlatform.makeAPICall';
    statusBarItem.text = '$(symbol-interface) AI Platform';
    statusBarItem.tooltip = 'Click to process selected text';
    statusBarItem.show();
    // Register configuration change handler
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('aiPlatform')) {
            // Reload configuration
            const config = vscode.workspace.getConfiguration('aiPlatform');
            process.env.ANTHROPIC_API_KEY = config.get('apiKey');
        }
    }));
    // Add to subscriptions
    context.subscriptions.push(disposable);
    context.subscriptions.push(batchDisposable);
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(apiManager);
}
exports.activate = activate;
function deactivate() {
    // Cleanup
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map