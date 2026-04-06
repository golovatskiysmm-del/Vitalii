export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

async function parsePdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return data.text as string;
}

async function parseDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value as string;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 });
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Файл слишком большой (макс. 5 МБ)' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const name = file.name.toLowerCase();

    let text = '';

    if (name.endsWith('.txt') || name.endsWith('.md')) {
      text = buffer.toString('utf-8');
    } else if (name.endsWith('.pdf')) {
      try {
        text = await parsePdf(buffer);
      } catch {
        return NextResponse.json({ error: 'Не удалось прочитать PDF. Убедитесь, что файл не защищён паролем.' }, { status: 422 });
      }
    } else if (name.endsWith('.docx')) {
      try {
        text = await parseDocx(buffer);
      } catch {
        return NextResponse.json({ error: 'Не удалось прочитать DOCX файл.' }, { status: 422 });
      }
    } else {
      return NextResponse.json(
        { error: 'Неподдерживаемый формат. Используйте PDF, DOCX или TXT.' },
        { status: 400 }
      );
    }

    text = text.replace(/\r\n/g, '\n').replace(/\n{4,}/g, '\n\n').trim();

    if (!text || text.length < 10) {
      return NextResponse.json({ error: 'Файл пустой или не содержит читаемого текста.' }, { status: 422 });
    }

    // Truncate to 20k chars to avoid token overflow
    const truncated = text.length > 20000 ? text.slice(0, 20000) + '\n\n[...текст обрезан...]' : text;

    return NextResponse.json({
      text: truncated,
      title: file.name,
      chars: truncated.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
