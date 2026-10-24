import * as vscode from 'vscode';
import { Settings } from './config';

export interface EditorContext {
  filename: string;
  languageId: string;
  prefix: string;
  suffix: string;
}

export function extractContext(
  document: vscode.TextDocument,
  position: vscode.Position,
  settings: Settings
): EditorContext | null {
  const text = document.getText();
  if (text.length > settings.maxFileChars) {
    return null;
  }
  const offset = document.offsetAt(position);
  const prefixStart = Math.max(0, offset - settings.prefixChars);
  const prefix = text.slice(prefixStart, offset);
  const suffix = text.slice(offset, offset + settings.suffixChars);

  const wsFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  let filename = document.uri.fsPath.split(/[\\/]/).pop() ?? 'untitled';
  if (wsFolder) {
    const rel = document.uri.fsPath.substring(wsFolder.uri.fsPath.length + 1);
    if (rel.length > 0 && rel.length < 120) {
      filename = rel;
    }
  }

  return {
    filename,
    languageId: document.languageId,
    prefix,
    suffix,
  };
}
