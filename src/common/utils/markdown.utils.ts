export function escapeMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/([\\`*_{}[\]()#+\-.!@])/g, '\\$1');
}
