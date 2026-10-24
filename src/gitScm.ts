import * as vscode from 'vscode';

// Minimal slice of the built-in git extension API (microsoft/vscode,
// extensions/git/src/api/git.d.ts). Declared locally so this extension does
// not need the git extension's typings at build time.
export interface Repository {
  readonly rootUri: vscode.Uri;
  readonly inputBox: { value: string };
  readonly state: {
    readonly indexChanges: unknown[];
    readonly workingTreeChanges: unknown[];
    readonly untrackedChanges: { readonly uri: vscode.Uri }[];
  };
  diff(cached?: boolean): Promise<string>;
}

export interface GitApi {
  readonly repositories: Repository[];
}

interface GitExtension {
  getAPI(version: 1): GitApi;
}

export async function getGitApi(): Promise<GitApi | undefined> {
  const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!ext) {
    return undefined;
  }
  const api = ext.isActive ? ext.exports : await ext.activate();
  return api?.getAPI(1);
}

/**
 * The repo holding the active file wins so the button targets what the user
 * is looking at. Single-repo workspaces and no-active-editor cases fall back
 * to the first repository.
 */
export function pickRepository(git: GitApi): Repository | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor && git.repositories.length > 1) {
    const fsPath = editor.document.uri.fsPath;
    const match = git.repositories.find((repo) => {
      const root = repo.rootUri.fsPath;
      return fsPath === root || fsPath.startsWith(root + '/');
    });
    if (match) {
      return match;
    }
  }
  return git.repositories[0];
}

export interface CommitContext {
  repoName: string;
  source: 'staged' | 'unstaged';
  diff: string;
}

const MAX_UNTRACKED_FILES = 10;
const MAX_UNTRACKED_FILE_CHARS = 4000;
const decoder = new TextDecoder();

function relativePath(root: vscode.Uri, file: vscode.Uri): string {
  const rootPath = root.fsPath.endsWith('/') ? root.fsPath : `${root.fsPath}/`;
  if (file.fsPath.startsWith(rootPath)) {
    return file.fsPath.slice(rootPath.length);
  }
  return file.fsPath.split(/[\\/]/).pop() ?? file.fsPath;
}

/**
 * Untracked files never appear in git diff output, so their contents get
 * folded into the context instead.
 */
async function readUntrackedFiles(repo: Repository): Promise<string> {
  const files = repo.state.untrackedChanges.slice(0, MAX_UNTRACKED_FILES);
  const blocks: string[] = [];
  for (const change of files) {
    try {
      const bytes = await vscode.workspace.fs.readFile(change.uri);
      const text = decoder.decode(bytes.slice(0, MAX_UNTRACKED_FILE_CHARS));
      blocks.push(`--- new file: ${relativePath(repo.rootUri, change.uri)} ---\n${text}`);
    } catch {
      // unreadable file: leave it out and keep going
    }
  }
  return blocks.join('\n');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n... diff truncated ...`;
}

/**
 * Staged changes first, falling back to unstaged changes plus untracked
 * files when the index is empty. Null means there is nothing to describe.
 */
export async function collectChanges(
  repo: Repository,
  maxDiffChars: number
): Promise<CommitContext | null> {
  const repoName = repo.rootUri.fsPath.split(/[\\/]/).pop() ?? 'repo';

  const staged = (await repo.diff(true)).trim();
  if (staged.length > 0) {
    return { repoName, source: 'staged', diff: truncate(staged, maxDiffChars) };
  }

  const unstaged = (await repo.diff(false)).trim();
  const newFiles = await readUntrackedFiles(repo);
  if (!unstaged && !newFiles) {
    return null;
  }
  const parts = [unstaged ? truncate(unstaged, maxDiffChars) : '', newFiles].filter(Boolean);
  return { repoName, source: 'unstaged', diff: parts.join('\n\n') };
}
