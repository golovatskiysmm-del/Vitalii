export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Word counts per minute at slow meditation pace (~120 wpm)
const WORDS_PER_MINUTE = 120;

const MEDITATION_TYPES = {
  sleep:       { ru: 'засыпание и глубокий сон', en: 'sleep and deep rest' },
  anxiety:     { ru: 'снятие тревоги и стресса', en: 'anxiety and stress relief' },
  focus:       { ru: 'концентрацию и фокус', en: 'focus and concentration' },
  energy:      { ru: 'энергию и бодрость', en: 'energy and vitality' },
  gratitude:   { ru: 'благодарность и принятие', en: 'gratitude and acceptance' },
  breathing:   { ru: 'дыхательные практики', en: 'breathing exercises' },
  bodyscan:    { ru: 'сканирование тела и расслабление', en: 'body scan and relaxation' },
  visualization: { ru: 'визуализацию и достижение целей', en: 'visualization and goal achievement' },
  custom:      { ru: 'пользовательскую тему', en: 'custom theme' },
};

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY не задан');
  return new Anthropic({ apiKey: key });
}

export async function POST(req: NextRequest) {
  try {
    const {
      type = 'sleep',
      duration = 10,
      language = 'ru',
      customTopic = '',
      userName = '',
      style = 'guided',
    } = await req.json() as {
      type?: keyof typeof MEDITATION_TYPES;
      duration?: number;
      language?: 'ru' | 'en';
      customTopic?: string;
      userName?: string;
      style?: string;
    };

    const targetWords = Math.round(duration * WORDS_PER_MINUTE);
    const meditationType = MEDITATION_TYPES[type] || MEDITATION_TYPES.sleep;
    const topicLabel = language === 'ru' ? meditationType.ru : meditationType.en;
    const finalTopic = type === 'custom' && customTopic ? customTopic : topicLabel;
    const langName = language === 'ru' ? 'русском' : 'английском';
    const userGreeting = userName ? (language === 'ru' ? `, ${userName}` : `, ${userName}`) : '';

    const systemPrompt = language === 'ru'
      ? `Ты профессиональный автор медитаций и практик осознанности. Пишешь только на русском языке.
Твои тексты:
- Плавные, с паузами (обозначай паузы многоточием... или тире — )
- Используют тихий, обволакивающий голос
- Содержат конкретные инструкции для тела и дыхания
- Ритмичные, без резких переходов
- Профессиональные, как у настоящего мастера медитаций
Пиши ТОЛЬКО сам текст медитации без заголовков, комментариев и пояснений.`
      : `You are a professional meditation and mindfulness author. Write only in English.
Your texts are smooth, with pauses (use ellipsis... or em-dash — ), use a calm soothing voice,
contain specific body and breath instructions, rhythmic, professional.
Write ONLY the meditation text itself, no titles, comments or explanations.`;

    const userPrompt = language === 'ru'
      ? `Напиши медитацию на тему "${finalTopic}" на ${langName} языке.
Длительность: примерно ${duration} минут (${targetWords} слов).
Стиль: ${style === 'guided' ? 'направляемая медитация с голосовыми инструкциями' : style === 'breathing' ? 'дыхательная практика с подсчётом' : 'медитация с визуализацией образов'}.
${userGreeting ? `Обращайся к слушателю как "${userName}".` : 'Используй нейтральное обращение.'}
Начни медитацию плавно, с успокоения дыхания. Заверши мягким возвращением к реальности.`
      : `Write a meditation on "${finalTopic}" in English.
Duration: approximately ${duration} minutes (~${targetWords} words).
Style: ${style}.
${userGreeting ? `Address the listener as "${userName}".` : 'Use neutral address.'}
Begin gently with breath settling. End with a soft return to awareness.`;

    const client = getClient();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const text = message.content.find(b => b.type === 'text')?.text ?? '';
    if (!text) throw new Error('Claude не вернул текст');

    return NextResponse.json({
      text,
      wordCount: text.split(/\s+/).length,
      estimatedMinutes: Math.round(text.split(/\s+/).length / WORDS_PER_MINUTE),
      charCount: text.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка генерации текста';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
