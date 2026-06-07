import { ManagedMessage } from '@src/libs/nezon';

function sanitizeString(text: string): string {
  if (!text) return '';

  let isPastHeader = false;

  const secureLines = text.split('\n').map((line) => {
    if (
      line.startsWith('├─────────────────────────────') ||
      line.startsWith('├───────')
    ) {
      isPastHeader = true;
      return line;
    }

    if (!isPastHeader) {
      return line;
    }

    const dynamicLabels = [
      'Title',
      'Desc',
      'Slug',
      'Content',
      'Name',
      'Project',
    ];

    const labelRegex = new RegExp(`│.*(${dynamicLabels.join('|')})\\s*:`);
    const hasLabel = labelRegex.test(line);

    if (hasLabel) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const prefix = line.slice(0, colonIndex + 1);
        const rawValue = line.slice(colonIndex + 1);

        let cleanValue = rawValue;
        if (cleanValue.includes('@everyone') || cleanValue.includes('@all')) {
          cleanValue = cleanValue
            .replace(/@everyone/g, 'everyone')
            .replace(/@all/g, 'all');
        }

        cleanValue = cleanValue.replace(/([\\`*{}[\]()#\\/.@])/g, '');

        return prefix + cleanValue;
      }
    }

    if (
      line.includes('│   [#') ||
      line.match(/│\s+(🟢|🟡|🔴|🔵|✅|⬛|❓)/) ||
      line.includes('💡') ||
      line.includes('*ticket') ||
      line.includes('*project')
    ) {
      if (line.includes('@everyone') || line.includes('@all')) {
        line = line.replace(/@everyone/g, 'everyone').replace(/@all/g, 'all');
      }
      return line.replace(/([\\`*_{}[\]()#@])/g, '');
    }

    return line;
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
