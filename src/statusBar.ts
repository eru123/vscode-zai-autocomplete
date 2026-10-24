import * as vscode from 'vscode';
import { ProviderState } from './completionProvider';

const TEXT: Record<ProviderState, string> = {
  idle: '$(zap) GLM',
  busy: '$(sync~spin) GLM',
  error: '$(zap-off) GLM',
  noKey: '$(key) GLM',
};

export class StatusBar {
  private readonly item: vscode.StatusBarItem;
  private state: ProviderState = 'idle';
  private detail = '';
  private disabled = false;
  private visible = true;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.name = 'ZAI Autocomplete';
    this.render();
  }

  setState(state: ProviderState, detail = '') {
    this.state = state;
    this.detail = detail;
    this.render();
  }

  setEnabled(enabled: boolean) {
    this.disabled = !enabled;
    this.render();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.render();
  }

  private render() {
    if (!this.visible) {
      this.item.hide();
      return;
    }
    const effective: ProviderState = this.disabled
      ? 'idle'
      : this.state;
    this.item.text = this.disabled ? '$(circle-slash) GLM' : TEXT[effective];
    this.item.command =
      this.state === 'noKey' && !this.disabled
        ? 'zaiAutocomplete.setApiKey'
        : 'zaiAutocomplete.toggle';

    const lines = [`ZAI Autocomplete: ${this.describe(effective)}`];
    if (this.detail) {
      lines.push(this.detail);
    }
    lines.push('Click to toggle suggestions.');
    this.item.tooltip = new vscode.MarkdownString(lines.join('\n\n'));
    this.item.show();
  }

  private describe(state: ProviderState): string {
    if (this.disabled) {
      return 'disabled';
    }
    switch (state) {
      case 'busy':
        return 'thinking';
      case 'error':
        return 'error (see output panel)';
      case 'noKey':
        return 'no API key set';
      default:
        return 'ready';
    }
  }

  dispose() {
    this.item.dispose();
  }
}
