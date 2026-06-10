import { ManagedMessage } from '@src/libs/nezon';

function sanitizeString(text: string): string {
  if (!text) return '';

  let isPastHeader = false;

  const secureLines = text.split('\n').map((line) => {
    if (line.startsWith('┌') || line.startsWith('├') || line.startsWith('└')) {
      if (line.includes('─────────────')) isPastHeader = true;
      return line;
    }

    if (!isPastHeader) return line;

    let sanitized = line;
    sanitized = sanitized.replace(/([\\`{}[\]()#^$%&=;`~@])/g, '');

    return sanitized;
  });

  return secureLines.join('\n');
}

export function applyMarkdownSecurity(message: ManagedMessage): void {
  if (!message || (message as any).__isSecure__) return;

  const originalReply = message.reply.bind(message);

  message.reply = async function (content: any, ...args: any[]) {
    if (!content) return originalReply(content, ...args);

    if (typeof content === 'string') {
      content = sanitizeString(content);
    } else if (typeof content === 'object') {
      if (content.content && typeof content.content.t === 'string') {
        content.content.t = sanitizeString(content.content.t);
      } else if (typeof content.text === 'string') {
        content.text = sanitizeString(content.text);
      }
    }

    return originalReply(content, ...args);
  };

  (message as any).__isSecure__ = true;
}
