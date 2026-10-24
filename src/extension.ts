import * as vscode from 'vscode';
import { GlmInlineCompletionProvider, ProviderState } from './completionProvider';
import { readSettings, SECTION, SECRET_KEY } from './config';
import { StatusBar } from './statusBar';

export function activate(context: vscode.ExtensionContext): void {
  const channel = vscode.window.createOutputChannel('ZAI Autocomplete');
  const statusBar = new StatusBar();

  let cachedKey: string | undefined;
  let keyLoaded = false;

  const getApiKey = async (): Promise<string | undefined> => {
    if (!keyLoaded) {
      cachedKey = await context.secrets.get(SECRET_KEY);
      keyLoaded = true;
      if (cachedKey) {
        channel.appendLine('API key loaded from secret storage');
      }
    }
    if (cachedKey) {
      return cachedKey;
    }
    // Fallback for headless setups: ZAI_API_KEY from the extension host env.
    return process.env.ZAI_API_KEY || undefined;
  };

  const log = (message: string) => channel.appendLine(message);

  const refreshUi = () => {
    const settings = readSettings();
    statusBar.setEnabled(settings.enabled);
    statusBar.setVisible(settings.showStatusBar);
  };

  const setState = (state: ProviderState, detail?: string) => {
    statusBar.setState(state, detail);
    if (state === 'error' && detail) {
      channel.appendLine(detail);
    }
  };

  const provider = new GlmInlineCompletionProvider({
    getSettings: readSettings,
    getApiKey,
    log,
    onState: setState,
  });

  const registration = vscode.languages.registerInlineCompletionItemProvider(
    [{ language: '*' }],
    provider
  );

  const setApiKey = vscode.commands.registerCommand(
    'zaiAutocomplete.setApiKey',
    async () => {
      const key = await vscode.window.showInputBox({
        prompt:
          'Paste your Z.AI API key. It is stored in VS Code secret storage, never in settings or files.',
        password: true,
        ignoreFocusOut: true,
        placeHolder: 'sk-...',
      });
      if (!key) {
        return;
      }
      await context.secrets.store(SECRET_KEY, key.trim());
      cachedKey = key.trim();
      keyLoaded = true;
      statusBar.setState('idle');
      vscode.window.showInformationMessage('ZAI Autocomplete: API key saved.');
    }
  );

  const clearApiKey = vscode.commands.registerCommand(
    'zaiAutocomplete.clearApiKey',
    async () => {
      await context.secrets.delete(SECRET_KEY);
      cachedKey = undefined;
      keyLoaded = true;
      statusBar.setState('noKey');
      vscode.window.showInformationMessage('ZAI Autocomplete: API key cleared.');
    }
  );

  const toggle = vscode.commands.registerCommand(
    'zaiAutocomplete.toggle',
    async () => {
      const current = readSettings().enabled;
      await vscode.workspace
        .getConfiguration(SECTION)
        .update('enabled', !current, vscode.ConfigurationTarget.Global);
      const settings = readSettings();
      statusBar.setEnabled(settings.enabled);
      vscode.window.setStatusBarMessage(
        `GLM suggestions ${settings.enabled ? 'enabled' : 'disabled'}`,
        3000
      );
    }
  );

  const trigger = vscode.commands.registerCommand(
    'zaiAutocomplete.trigger',
    async () => {
      try {
        await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
      } catch {
        vscode.window.showWarningMessage(
          'Inline suggestions cannot be triggered in this editor.'
        );
      }
    }
  );

  const showLogs = vscode.commands.registerCommand(
    'zaiAutocomplete.showLogs',
    () => channel.show()
  );

  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(SECTION)) {
      refreshUi();
    }
  });

  context.subscriptions.push(
    registration,
    setApiKey,
    clearApiKey,
    toggle,
    trigger,
    showLogs,
    configWatcher,
    statusBar,
    channel
  );

  refreshUi();
  channel.appendLine('ZAI Autocomplete active');
}

export function deactivate(): void {
  // nothing to tear down beyond registered disposables
}
