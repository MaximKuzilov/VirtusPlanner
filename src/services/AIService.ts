import { AI_CONFIG, isAIConfigured } from '../config/aiConfig';
import { Task, TaskCategory, TaskPriority, AppSettings } from '../store/types';
import { fetchJSON } from './http';

// Yandex Foundation Models endpoint
const YANDEX_AI_STUDIO_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

// ─── Типы для AI-команд ────────────────────────────────────────────────────
export type AIActionType =
  | 'ADD_TASK'
  | 'UPDATE_TASK'
  | 'DELETE_TASK'
  | 'COMPLETE_TASK'
  | 'UNCOMPLETE_TASK'
  | 'NONE';

export interface AIAction {
  type: AIActionType;
  taskId?: string;
  // Для ADD_TASK
  newTask?: {
    title: string;
    time: string;
    date: string;
    category: TaskCategory;
    priority: TaskPriority;
    duration?: number; // минуты, например 90
  };
  updates?: {
    title?: string;
    time?: string;
    date?: string;
    priority?: TaskPriority;
    category?: TaskCategory;
    duration?: number; // минуты
  };
}

export interface AICommandResponse {
  text: string;       // сообщение для отображения в чате
  action?: AIAction;  // одно действие (обратная совместимость)
  actions?: AIAction[]; // несколько действий сразу
}

// ─── Yandex API внутренние типы ────────────────────────────────────────────
interface YandexMessage {
  role: 'system' | 'user' | 'assistant';
  text: string;
}

interface YandexRequest {
  modelUri: string;
  completionOptions: { maxTokens: string; temperature: number };
  messages: YandexMessage[];
}

interface YandexResponse {
  result: {
    alternatives: Array<{ message: { role: string; text: string }; status: string }>;
  };
}

// ─── Системный промпт ──────────────────────────────────────────────────────
function buildSystemPrompt(
  tasks: Task[],
  userName: string,
  completionRate: number,
  locationContext?: string,
  settings?: AppSettings,
  userEmail?: string,
): string {
  const today = new Date();
  const nowHH = today.getHours();
  const nowMM = today.getMinutes();
  const nowMinutes = nowHH * 60 + nowMM;
  const currentTimeStr = `${String(nowHH).padStart(2,'0')}:${String(nowMM).padStart(2,'0')}`;

  function fmt(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function fmtRu(d: Date): string {
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  }

  const dateKey = fmt(today);
  const todayStr = fmtRu(today);
  const weekdayNames = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  const weekday = weekdayNames[today.getDay()];

  const makeFuture = (n: number) => { const d = new Date(today); d.setDate(today.getDate()+n); return d; };
  const tomorrow = makeFuture(1);
  const dayAfterTomorrow = makeFuture(2);

  const upcomingWeekdays: Record<string, string> = {};
  for (let i = 1; i <= 7; i++) {
    const d = makeFuture(i);
    const name = weekdayNames[d.getDay()];
    if (!upcomingWeekdays[name]) upcomingWeekdays[name] = fmt(d);
  }

  const dateReference = [
    `• "сегодня" → ${dateKey} (${todayStr}, ${weekday})`,
    `• "завтра" → ${fmt(tomorrow)} (${fmtRu(tomorrow)}, ${weekdayNames[tomorrow.getDay()]})`,
    `• "послезавтра" → ${fmt(dayAfterTomorrow)} (${fmtRu(dayAfterTomorrow)}, ${weekdayNames[dayAfterTomorrow.getDay()]})`,
    ...Object.entries(upcomingWeekdays).map(([name, key]) => `• "в ${name}" / "на ${name}" → ${key}`),
    `• "следующая неделя" → ${fmt(makeFuture(7))} — ${fmt(makeFuture(13))}`,
    `• "через N дней" → прибавь N к ${dateKey}`,
    `• "через неделю" → ${fmt(makeFuture(7))}`,
    `• "через 2 недели" → ${fmt(makeFuture(14))}`,
    `• "в начале следующей недели" → ближайший понедельник = ${upcomingWeekdays['понедельник'] ?? fmt(makeFuture(1))}`,
  ].join('\n');

  const todayTasks = tasks
    .filter(t => t.date === dateKey)
    .sort((a, b) => a.time.localeCompare(b.time));
  const doneTasks = todayTasks.filter(t => t.completed);

  // Занятые слоты сегодня
  const busySlots = todayTasks.map(t => {
    const [h, m] = t.time.split(':').map(Number);
    const dur = t.duration || 60;
    return { start: h*60+m, end: h*60+m+dur };
  });

  function slotFree(start: number, dur: number, busy: {start:number;end:number}[]): boolean {
    return !busy.some(s => start < s.end && start + dur > s.start);
  }

  function findFreeSlots(): string {
    const END = 22*60;
    if (nowMinutes >= END) return 'Сегодня уже поздно.';
    const startFrom = Math.ceil(nowMinutes/30)*30;
    const slots: string[] = [];
    for (let t = startFrom; t <= END-30; t += 30) {
      if (slotFree(t, 30, busySlots))
        slots.push(`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`);
    }
    if (!slots.length) return 'Свободного времени сегодня нет.';
    const ranges: string[] = [];
    let rs = slots[0], prev = slots[0];
    for (let i = 1; i < slots.length; i++) {
      const [ph,pm] = prev.split(':').map(Number);
      const [ch,cm] = slots[i].split(':').map(Number);
      if (ch*60+cm - (ph*60+pm) > 30) { ranges.push(rs===prev?rs:`${rs}–${prev}`); rs = slots[i]; }
      prev = slots[i];
    }
    ranges.push(rs===prev?rs:`${rs}–${prev}`);
    return ranges.slice(0,6).join(', ');
  }

  function suggestTime(): string {
    const END = 22*60;
    const startFrom = Math.ceil(nowMinutes/30)*30;
    for (let t = startFrom; t <= END-30; t += 30) {
      if (slotFree(t, 60, busySlots))
        return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
    }
    return `${fmt(tomorrow)} 09:00`;
  }

  // Предлагаем N свободных временных слотов подряд (для создания нескольких задач)
  function suggestMultipleTimes(n: number, durMinutes = 60): string[] {
    const END = 22*60;
    const startFrom = Math.max(Math.ceil(nowMinutes/30)*30, 8*60);
    const result: string[] = [];
    const tempBusy = [...busySlots];
    let cursor = startFrom;
    while (result.length < n && cursor <= END - durMinutes) {
      if (slotFree(cursor, durMinutes, tempBusy)) {
        const ts = `${String(Math.floor(cursor/60)).padStart(2,'0')}:${String(cursor%60).padStart(2,'0')}`;
        result.push(ts);
        tempBusy.push({ start: cursor, end: cursor + durMinutes });
        cursor += durMinutes + 15;
      } else {
        cursor += 30;
      }
    }
    return result;
  }

  const freeSlots = findFreeSlots();
  const suggestedTime = suggestTime();
  const suggestedTimes = suggestMultipleTimes(6);

  let taskContext = '';
  if (todayTasks.length > 0) {
    taskContext = '\n\nЗАДАЧИ НА СЕГОДНЯ (используй ID при командах UPDATE/DELETE/COMPLETE):\n';
    todayTasks.forEach(t => {
      const [th,tm] = t.time.split(':').map(Number);
      const isOverdue = !t.completed && (th*60+tm) < nowMinutes;
      const statusTag = t.completed ? '✅ выполнено' : isOverdue ? '⏰ просрочено' : '🔵 активна';
      const durStr = t.duration ? `${t.duration} мин` : '60 мин';
      taskContext += `  [ID:${t.id}] ${t.time} (${durStr}) — "${t.title}" [${statusTag}] категория:${t.category} приоритет:${t.priority}\n`;
    });
    taskContext += `Выполнено: ${doneTasks.length}/${todayTasks.length}`;
  } else {
    taskContext = '\n\nСегодня задач нет.';
  }

  // Все будущие задачи, сгруппированные по датам
  const futureTasks = tasks
    .filter(t => t.date > dateKey)
    .sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  if (futureTasks.length > 0) {
    taskContext += '\n\nБУДУЩИЕ ЗАДАЧИ:\n';
    const byDate: Record<string, Task[]> = {};
    futureTasks.forEach(t => {
      if (!byDate[t.date]) byDate[t.date] = [];
      byDate[t.date].push(t);
    });
    Object.entries(byDate).slice(0, 21).forEach(([date, dateTasks]) => {
      const d = new Date(date + 'T00:00:00');
      const dayName = weekdayNames[d.getDay()];
      taskContext += `  📅 ${date} (${dayName}):\n`;
      dateTasks.forEach(t => {
        taskContext += `    [ID:${t.id}] ${t.time} (${t.duration||60} мин) — "${t.title}" [${t.completed?'✅':'🔵'}] ${t.category} ${t.priority}\n`;
      });
    });
  }

  const locationSection = locationContext ? `\n\nТЕКУЩАЯ ЛОКАЦИЯ: ${locationContext}` : '';

  const settingsSection = settings ? `\nНАСТРОЙКИ ПРИЛОЖЕНИЯ: тема: ${settings.darkMode ? 'тёмная' : 'светлая'} | уведомления: ${settings.notifications ? 'вкл' : 'выкл'} | тихие часы: ${settings.quietHoursStart}–${settings.quietHoursEnd}` : '';

  return `Ты — Виртус, персональный ИИ-планировщик в приложении VirtusPlanner.
Пользователь: ${userName}${userEmail ? ' (' + userEmail + ')' : ''} | Продуктивность за неделю: ${completionRate}%
Сегодня: ${todayStr} (${weekday}) | Текущее время: ${currentTimeStr}
Дата для JSON: ${dateKey}
Свободные окна сегодня (после ${currentTimeStr}): ${freeSlots}
Рекомендуемые слоты для новых задач: ${suggestedTimes.join(', ') || suggestedTime}${settingsSection}
${taskContext}${locationSection}

═══════════════════════════════════════════════════════
ТАБЛИЦА ДАТ — используй ТОЧНО эти значения в JSON:
${dateReference}
═══════════════════════════════════════════════════════
ДЛИТЕЛЬНОСТЬ → минуты (поле "duration").
СНАЧАЛА проверь, указал ли пользователь время явно ("на 2 часа", "30 мин" и т.д.).
Если НЕ указал — определяй по типу задачи:

  Питание и бытовое:
  • завтрак, ужин, кофе, чай, перекус → 30
  • обед, приготовить еду, готовка → 45
  • уборка, стирка → 60
  • поход в магазин / продукты → 45
  • поход в аптеку → 30

  Спорт и активность:
  • пробежка, бег → 45
  • прогулка → 45
  • тренировка, зал, фитнес, спорт → 90
  • йога, медитация, растяжка → 45
  • бассейн → 90

  Обучение:
  • лекция, урок, семинар → 90
  • лабораторная (лаба) → 120
  • экзамен → 180
  • читать книгу, изучить тему → 60
  • выполнить ДЗ, домашнее задание → 60
  • курс (онлайн-урок) → 60

  Работа:
  • созвон, звонок → 30
  • встреча, переговоры → 60
  • презентация → 60
  • работа над проектом, разработка, задание → 120
  • написать отчёт, написать письмо → 45
  • проверка почты → 20 → округли до 30

  Личное / здоровье:
  • врач, больница → 90
  • парикмахер, маникюр → 60
  • банк → 30
  • позвонить другу, разговор по телефону → 30

  Отдых:
  • кино, сериал → 120
  • игра, видеоигры → 90
  • концерт, театр → 180
  • отдых, сон (дневной) → 60

  Если тип задачи не совпадает ни с одним — ставь 60.
  Можно округлять до ближайших 15 мин.

Явные фразы пользователя (всегда приоритет над автоматическим):
• "полчаса" / "30 минут" → 30
• "час" → 60 | "полтора часа" / "1.5 ч" → 90
• "2 часа" → 120 | "3 часа" → 180 | "4 часа" → 240 | "весь день" → 480
═══════════════════════════════════════════════════════
КАТЕГОРИИ (определяй автоматически по ключевым словам):
• Работа: работа, встреча, созвон, проект, задание, презентация, дедлайн, отчёт, клиент, офис, переговоры
• Обучение: учёба, лекция, лаба, лабораторная, семинар, экзамен, курс, диплом, изучить, читать, книга, урок
• Отдых: тренировка, спорт, зал, бег, йога, прогулка, отдых, игра, кино, концерт, хобби, медитация
• Личное: магазин, продукты, врач, аптека, готовить, уборка, стирка, семья, друзья, купить, позвонить, банк
• Другое: всё остальное
═══════════════════════════════════════════════════════
ПРИОРИТЕТ (по контексту):
• high: срочно, важно, критично, дедлайн, обязательно, горит
• low: не срочно, можно позже, когда будет время, при возможности
• medium: всё остальное
═══════════════════════════════════════════════════════
══════════ ПРАВИЛА ПОВЕДЕНИЯ ══════════

★ ПЕРЕД ЛЮБЫМ ОТВЕТОМ — прочитай список задач выше. Он отражает РЕАЛЬНЫЕ данные.
  Не придумывай задачи, которых там нет. Не фантазируй о содержимом расписания.

★ ДЕДУПЛИКАЦИЯ — ОБЯЗАТЕЛЬНО перед ADD_TASK:
  Проверь: есть ли в списке задач задача с похожим названием на ту же дату?
  Похожесть = совпадение ключевого слова (напр. "тренировка", "завтрак", "встреча").
  Если дубликат найден — НЕ создавай, сообщи: "У тебя уже есть «Название» в HH:MM на эту дату."
  Если батч (actions[]) содержит дубликаты между собой — оставь только первый.

★ СОВЕТЫ ≠ ДЕЙСТВИЯ — КРИТИЧЕСКИ ВАЖНО:
  Вопросы вида "как лучше", "как распределить", "что посоветуешь", "как мне",
  "можешь подсказать", "порекомендуй", "оптимально ли", "как правильно" —
  это просьба о СОВЕТЕ, НЕ о создании задач.
  → Отвечай ТОЛЬКО текстом. НЕ создавай никаких задач. НЕ выдавай JSON.
  → Примеры ответа: предложи оптимальный порядок, объясни почему, дай рекомендации.

▶ ДОБАВИТЬ ЗАДАЧУ ("добавь", "запиши", "создай", "напомни", "запланируй"):
  → Создавай НЕМЕДЛЕННО через ADD_TASK, не спрашивай подтверждения.
  → Если время не указано — бери из списка "Рекомендуемые слоты" выше.
  → Если несколько задач в одном сообщении — создавай ВСЕ через actions[].
  → ПЕРЕД СОЗДАНИЕМ: проверь дедупликацию!

▶ НЕСКОЛЬКО ЗАДАЧ В ОДНОМ ЗАПРОСЕ (ГЛАВНОЕ ПРАВИЛО):
  Примеры: "добавь встречу в 9 и обед в 13"
           "создай: тренировка, завтрак, работа"
           "запланируй на завтра: X в 9, Y в 12, Z в 15"
           "добавь 3 задачи: ..."
           "на этой неделе нужно: A, B, C"
  → ОБЯЗАТЕЛЬНО используй {"actions":[...]} для ВСЕХ задач сразу.
  → Если времена не указаны — авто-распредели из свободных слотов, не создавай конфликты.
  → НЕ создавай задачи по одной — ВСЕГДА в одном ответе.
  → Проверяй дедупликацию для каждой задачи!

▶ ПЛАНИРОВАНИЕ ДНЯ ("распланируй день", "составь расписание", "распиши завтра"):
  ТОЛЬКО когда пользователь явно просит СОЗДАТЬ/ЗАПИСАТЬ расписание.
  → Создай 4–7 задач через actions[], учитывая уже существующие задачи на тот день.
  → НЕ дублируй уже существующие задачи.
  → Охвати свободные промежутки: утро (08–10), день (11–14), вечер (17–20).

▶ РЕГУЛЯРНЫЕ / ПОВТОРЯЮЩИЕСЯ ЗАДАЧИ:
  "добавь тренировку каждый день на неделе" → создай через actions[] для каждого дня.
  "по пн/ср/пт" → создай для каждого соответствующего дня из таблицы дат выше.
  "каждый день на следующей неделе" → 7 ADD_TASK с датами следующей недели.
  → Для каждой даты проверь дедупликацию!

▶ ПОИСК ЗАДАЧИ ПО НАЗВАНИЮ — АЛГОРИТМ (строго по порядку):

  ШАГ 1 — ОПРЕДЕЛИ ДАТУ из запроса пользователя:
  • "сегодняшний", "сегодня", "сейчас" → искать ТОЛЬКО среди задач на ${dateKey}
  • "завтрашний", "завтра" → искать ТОЛЬКО среди задач на ${fmt(tomorrow)}
  • "в [день недели]", "на [день недели]" → найди дату по таблице дат выше, искать ТОЛЬКО там
  • "послезавтра" → искать ТОЛЬКО среди задач на ${fmt(dayAfterTomorrow)}
  • Дата не указана → ищи сначала среди СЕГОДНЯШНИХ, потом среди будущих

  ШАГ 2 — НАЙДИ задачу по ключевому слову в названии ТОЛЬКО в рамках найденной даты.

  ШАГ 3 — ПРОВЕРЬ результат:
  • Нашёл ровно одну → используй её ID.
  • Нашёл несколько на той же дате → уточни:
    "Какую задачу имеешь в виду?\n[ID1] 09:00 Название А\n[ID2] 15:00 Название Б"
  • Не нашёл на указанной дате → сообщи: "Не вижу «ключевое слово» на [дата]. Возможно имеешь в виду другую дату?"
  • НИКОГДА не выбирай задачу с другой даты, если пользователь указал конкретный день.

  ПРИМЕРЫ:
  "измени сегодняшний поход за продуктами" → искать "продукты"/"поход" только в ${dateKey}
  "перенеси завтрашнюю тренировку на 19:00" → искать "тренировка" только в ${fmt(tomorrow)}
  "удали встречу в четверг" → искать "встреча" только в задачах на четверг (дата из таблицы выше)
  "отметь лабу выполненной" → искать "лаба"/"лабораторная" в сегодняшних, затем в будущих

▶ ПАКЕТНЫЕ ОПЕРАЦИИ:
  "отметь все задачи выполненными" → COMPLETE_TASK для каждой невыполненной задачи сегодня через actions[].
  "удали все задачи на сегодня" → DELETE_TASK для каждой сегодняшней задачи через actions[].
  "удали все задачи на [дата]" → DELETE_TASK для каждой задачи на ту дату через actions[].

▶ ИЗМЕНЕНИЕ ЗАДАЧИ (UPDATE_TASK) — меняй ВСЕ упомянутые поля одновременно:
  "перенеси на 15:00" → updates.time = "15:00"
  "перенеси на завтра" → updates.date = "${fmt(tomorrow)}"
  "переименуй в X" → updates.title = "X"
  "высокий приоритет" → updates.priority = "high"
  "категория Работа" → updates.category = "Работа"
  "на 3 часа" / "3 часа" / "займёт 3 часа" → updates.duration = 180
  Можно менять несколько полей в одном UPDATE_TASK.

▶ ВЫПОЛНЕНА → COMPLETE_TASK
▶ СНЯТЬ ВЫПОЛНЕНИЕ → UNCOMPLETE_TASK
▶ УДАЛИТЬ → DELETE_TASK

▶ "надо бы", "нужно", "хочу" — без конкретного времени:
  → Предложи слот: "Записать тебя на ${suggestedTime}?"
  → Жди подтверждения.

▶ ПОДТВЕРЖДАЕТ ("да", "ок", "давай", "запиши", "хорошо"):
  → Создай ADD_TASK с предложенным временем из предыдущего сообщения.

▶ ПРОШЕДШЕЕ ВРЕМЯ СЕГОДНЯ:
  → "Время X уже прошло, поставлю на ${suggestedTime}?"

▶ ВОПРОСЫ / РАЗГОВОР / СОВЕТЫ / АНАЛИТИКА / "КАК ЛУЧШЕ" / "КАК РАСПРЕДЕЛИТЬ" → только текстом, без JSON.

★ ТЫ И ЕСТЬ ПРИЛОЖЕНИЕ — КРИТИЧЕСКИ ВАЖНО:
  НИКОГДА не советуй пользователю "использовать приложение для планирования", "завести ежедневник",
  "скачать планировщик" или любые внешние инструменты планирования.
  Ты сам и есть этот инструмент. Вместо этого говори:
  • "Я могу добавить это в твоё расписание — скажи когда"
  • "Давай запланируем прямо сейчас — напиши задачи"
  • "Хочешь, составлю тебе расписание на неделю?"
  При советах по тайм-менеджменту всегда предлагай конкретные действия ВНУТРИ приложения.
═══════════════════════════════════════════════════════
══════════ JSON-ФОРМАТЫ (СТРОГО) ══════════

ПРАВИЛА JSON:
1. Только чистый JSON — БЕЗ \`\`\`, БЕЗ текста до/после
2. Поле "message" ОБЯЗАТЕЛЬНО всегда
3. Для 2+ задач/операций — ВСЕГДА {"actions":[...]}
4. Каждый элемент actions[] содержит "action" (не "type")

──── Добавить одну задачу ────
{"action":"ADD_TASK","newTask":{"title":"Название","time":"09:00","date":"${dateKey}","category":"Личное","priority":"medium","duration":60},"message":"✅ Записал: «Название» на 09:00 📌"}

──── Добавить НЕСКОЛЬКО задач (ОБЯЗАТЕЛЬНО через actions) ────
{"actions":[{"action":"ADD_TASK","newTask":{"title":"Встреча с командой","time":"09:00","date":"${dateKey}","category":"Работа","priority":"high","duration":60}},{"action":"ADD_TASK","newTask":{"title":"Обед","time":"13:00","date":"${dateKey}","category":"Личное","priority":"low","duration":60}},{"action":"ADD_TASK","newTask":{"title":"Тренировка","time":"18:00","date":"${dateKey}","category":"Отдых","priority":"medium","duration":90}}],"message":"✅ Добавил 3 задачи: встреча в 09:00, обед в 13:00, тренировка в 18:00 📌"}

──── Изменить задачу (одно или несколько полей) ────
{"action":"UPDATE_TASK","taskId":"ID","updates":{"time":"16:00","duration":120},"message":"✏️ Обновил задачу!"}

──── Отметить выполненной ────
{"action":"COMPLETE_TASK","taskId":"ID","message":"✅ Отмечено выполненным!"}

──── Снять отметку ────
{"action":"UNCOMPLETE_TASK","taskId":"ID","message":"↩️ Возвращено в список"}

──── Удалить ────
{"action":"DELETE_TASK","taskId":"ID","message":"🗑️ Удалено"}

──── Несколько РАЗНЫХ операций ────
{"actions":[{"action":"COMPLETE_TASK","taskId":"ID1"},{"action":"DELETE_TASK","taskId":"ID2"},{"action":"ADD_TASK","newTask":{"title":"Новая задача","time":"19:00","date":"${dateKey}","category":"Личное","priority":"medium","duration":60}}],"message":"✅ Выполнено 3 действия: отметил, удалил, добавил новую на 19:00"}

──── Пакетное выполнение всех задач сегодня ────
{"actions":[{"action":"COMPLETE_TASK","taskId":"ID1"},{"action":"COMPLETE_TASK","taskId":"ID2"}],"message":"✅ Все задачи на сегодня отмечены выполненными!"}

──── Добавить задачи на каждый день недели ────
{"actions":[{"action":"ADD_TASK","newTask":{"title":"Тренировка","time":"07:00","date":"${fmt(makeFuture(1))}","category":"Отдых","priority":"medium","duration":60}},{"action":"ADD_TASK","newTask":{"title":"Тренировка","time":"07:00","date":"${fmt(makeFuture(2))}","category":"Отдых","priority":"medium","duration":60}}],"message":"✅ Добавил тренировки на 2 дня!"}

═══════════════════════════════════════════════════════
КРИТИЧЕСКИ ВАЖНО:
- Для 2+ задач ВСЕГДА {"actions":[...]} — НИКОГДА не отвечай несколькими JSON подряд
- ID берёшь ТОЛЬКО из списка задач выше, не придумывай
- Если не знаешь ID — ищи задачу по ключевым словам в названии
- НИКОГДА не создавай задачи, которых нет в запросе пользователя
- НИКОГДА не создавай дубликаты — проверяй существующие задачи
- Вопросы и советы ("как лучше", "как распределить") — ТОЛЬКО текст, НИКАКОГО JSON
- Стиль: русский язык, тёплый дружелюбный тон, краткие ответы, умеренные эмодзи`;
}

// ─── Парсинг JSON-команды из ответа AI ────────────────────────────────────
export function parseAIResponse(rawText: string): AICommandResponse {
  // Обрабатываем формат [TOOL_CALL_START]...[TOOL_CALL_END] (Yandex model tool calls)
  let workText = rawText;
  const toolCallMatch = rawText.match(/\[TOOL_CALL_START\]([\s\S]*?)(?:\[TOOL_CALL_END\]|$)/);
  if (toolCallMatch) {
    let content = toolCallMatch[1].trim();
    // Если контент не начинается с { — оборачиваем
    if (!content.startsWith('{')) {
      content = '{' + content;
      if (!content.endsWith('}')) content += '}';
    }
    workText = content;
  }

  // Убираем markdown-блоки ```json ... ``` или ``` ... ```
  const stripped = workText.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();

  // Ищем начало JSON-объекта
  const startIdx = stripped.indexOf('{');
  if (startIdx === -1) return { text: rawText };

  // Находим закрывающую скобку с учётом вложенности
  let depth = 0;
  let endIdx = -1;
  let inString = false;
  let escaped = false;
  for (let i = startIdx; i < stripped.length; i++) {
    const char = stripped[i];
    if (escaped) { escaped = false; continue; }
    if (inString && char === '\\') { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (stripped[i] === '{') depth++;
    else if (stripped[i] === '}') {
      depth--;
      if (depth === 0) { endIdx = i; break; }
    }
  }

  if (endIdx === -1) return { text: rawText };

  const jsonStr = stripped.slice(startIdx, endIdx + 1);

  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed.message !== 'string' || !parsed.message.trim()) return { text: rawText };

    // Несколько действий сразу
    if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
      const actions: AIAction[] = parsed.actions.map((a: any) => ({
        type: a.action as AIActionType,
        taskId: a.taskId,
        updates: a.updates,
        newTask: a.newTask,
      }));
      return { text: parsed.message, actions };
    }

    // Одно действие
    if (parsed.action) {
      const action: AIAction = {
        type: parsed.action as AIActionType,
        taskId: parsed.taskId,
        updates: parsed.updates,
        newTask: parsed.newTask,
      };
      return { text: parsed.message, action };
    }

    // JSON без действия — просто сообщение
    return { text: parsed.message };
  } catch {
    return { text: rawText };
  }
}

// ─── Основная функция вызова YandexGPT ─────────────────────────────────────
export async function sendMessageToYandexGPT(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; text: string }>,
  tasks: Task[],
  userName: string,
  completionRate: number,
  locationContext?: string,
  settings?: AppSettings,
  userEmail?: string,
): Promise<AICommandResponse> {
  if (!isAIConfigured()) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  const systemPrompt = buildSystemPrompt(tasks, userName, completionRate, locationContext, settings, userEmail);

  const messages: YandexMessage[] = [
    { role: 'system', text: systemPrompt },
    ...conversationHistory.map(m => ({ role: m.role, text: m.text })),
    { role: 'user', text: userMessage },
  ];

  const requestBody: YandexRequest = {
    modelUri: `gpt://${AI_CONFIG.YANDEX_FOLDER_ID}/${AI_CONFIG.MODEL}/latest`,
    completionOptions: {
      maxTokens: String(AI_CONFIG.MAX_TOKENS),
      temperature: AI_CONFIG.TEMPERATURE,
    },
    messages,
  };

  const data: YandexResponse = await fetchJSON(YANDEX_AI_STUDIO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Api-Key ${AI_CONFIG.YANDEX_API_KEY}`,
      'x-folder-id': AI_CONFIG.YANDEX_FOLDER_ID,
    },
    body: JSON.stringify(requestBody),
  });

  const text = data?.result?.alternatives?.[0]?.message?.text;

  if (!text) {
    throw new Error('Пустой ответ от YandexGPT');
  }

  return parseAIResponse(text);
}
