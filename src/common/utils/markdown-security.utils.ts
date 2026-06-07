import { ManagedMessage } from '@src/libs/nezon';

function escapeString(text: string): string {
  if (!text) return '';

  if (text.includes('http://') || text.includes('https://')) {
    text = text
      .replace(/https:\/\//gi, 'https\\://')
      .replace(/http:\/\//gi, 'http\\://');
  }

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
        const value = line.slice(colonIndex + 1);

        let safeValue = value;
        if (safeValue.includes('@everyone') || safeValue.includes('@all')) {
          safeValue = safeValue
            .replace(/@everyone/g, '\\@everyone')
            .replace(/@all/g, '\\@all');
        }

        safeValue = safeValue.replace(/([\\`*_{}[\]()#@])/g, '\\$1');
        return prefix + safeValue;
      }
    }

    if (
      line.includes('│   [#') ||
      line.match(/│\s+(🟡|🔵|✅|⬛|❓)/) ||
      line.includes('💡') ||
      line.includes('*ticket') ||
      line.includes('*project')
    ) {
      if (line.includes('@everyone') || line.includes('@all')) {
        line = line
          .replace(/@everyone/g, '\\@everyone')
          .replace(/@all/g, '\\@all');
      }
      return line.replace(/([\\`_{}[\]()#@])/g, '\\$1');
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
      content = escapeString(content);
    } else if (typeof content === 'object') {
      if (content.content && typeof content.content.t === 'string') {
        content.content.t = escapeString(content.content.t);
      } else if (typeof content.text === 'string') {
        content.text = escapeString(content.text);
      }
    }

    return originalReply(content, ...args);
  };

  (message as any).__isSecure__ = true;
}
