import { ManagedMessage } from '@src/libs/nezon';

/**
 * Removes dangerous markdown characters and handles mass mentions directly
 * by stripping or replacing them to ensure clean, non-executable text.
 */
function sanitizeString(text: string): string {
  if (!text) return '';

  let isPastHeader = false;

  const secureLines = text.split('\n').map((line) => {
    // Nhận diện đường kẻ khung để bắt đầu xử lý phần dữ liệu động
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

    // Các trường chứa dữ liệu do người dùng nhập vào
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
        const prefix = line.slice(0, colonIndex + 1); // Giữ nguyên phần "│ Name :"
        const rawValue = line.slice(colonIndex + 1);

        // 1. Xử lý hạ bệ các lệnh mass mention nguy hiểm thành text thường
        let cleanValue = rawValue;
        if (cleanValue.includes('@everyone') || cleanValue.includes('@all')) {
          cleanValue = cleanValue
            .replace(/@everyone/g, 'everyone')
            .replace(/@all/g, 'all');
        }

        cleanValue = cleanValue.replace(/([\\`*{}[\]()#\\.@])/g, '');

        return prefix + cleanValue;
      }
    }

    // Xử lý các dòng danh sách hoặc lệnh cụ thể chứa text động
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
      // Xóa các ký tự markdown gây vỡ khung danh sách (trừ các icon và chữ gốc)
      return line.replace(/([\\`*_{}[\]()#@])/g, '');
    }

    return line;
  });

  return secureLines.join('\n');
}

/**
 * Intercepts outgoing bot responses to guarantee structural output security.
 */
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
