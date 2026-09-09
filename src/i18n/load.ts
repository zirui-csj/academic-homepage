/**
 * i18n 数据加载模块（统一文件读取接口 / 数据接口层）
 *
 * 机制：
 * - 语言清单来自 locales.config.json；enabled: true 的语言必须齐备 5 个内容文件 + ui 文案字典，
 *   否则构建失败并明确报错（需求 F14.8 / §4.4(3) 的完整性门禁）。
 * - enabled: false 的语言直接跳过——英文内容未就绪时可先只上线中文版（分期交付）。
 * - 各语言数据集完全独立：不做跨语言 id 对齐、不回退、不混显。
 */
import { z } from 'astro:schema';

// ---------- Schema 定义（构建时校验依据） ----------

const linkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  icon: z.string().min(1),
});

const profileSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  affiliation: z.string().nullable().optional(),
  avatar: z.string().min(1),
  email: z.string().email(),
  bio: z.array(z.string().min(1)).min(1),
  address: z.string().nullable().optional(),
  links: z.array(linkSchema),
  cvFile: z.string().nullable().optional(),
});

const educationSchema = z.object({
  id: z.string().min(1),
  startDate: z.string().min(4),
  endDate: z.string().min(4),
  institution: z.string().min(1),
  degree: z.string().min(1),
  major: z.string().min(1).nullable().optional(),
  department: z.string().nullable().optional(),
  advisor: z.string().nullable().optional(),
  advisorLabel: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  kind: z.enum(['main', 'secondary']).default('main'),
});

const researchSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  icon: z.string().nullable().optional(),
  keywords: z.array(z.string().min(1)).optional(),
  description: z.string().nullable().optional(),
});

const publicationSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['journal', 'conference', 'chapter']),
  title: z.string().min(1),
  authors: z
    .array(z.object({ name: z.string().min(1), isSelf: z.boolean().optional() }))
    .min(1),
  venue: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  /** 编者（集刊/章节引证），如 "Chen, Zhongmin (ed)" */
  editors: z.string().nullable().optional(),
  volume: z.string().nullable().optional(),
  pages: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  pdf: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  abstract: z.string().nullable().optional(),
  bibtex: z.string().nullable().optional(),
  highlight: z.boolean().optional(),
  status: z.string().nullable().optional(),
});

const projectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** 项目年度，如 "2024" */
  year: z.string().min(4),
  role: z.string().min(1),
  fundingAgency: z.string().min(1),
  grantNumber: z.string().nullable().optional(),
  /** 项目负责人 */
  pi: z.string().nullable().optional(),
  // 以下为可选扩展字段（兼容）
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  amount: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

const awardSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** 颁奖单位（已移除展示，保留为可选以兼容历史数据） */
  issuer: z.string().nullable().optional(),
  /** 获奖时间，格式 "YYYY-MM" */
  date: z.string().min(4),
  /** 类别：academic 学术类 / general 综合类 / other 其他 */
  category: z.enum(['academic', 'general', 'other']).default('other'),
  level: z.string().nullable().optional(),
  rank: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

const sectionsConfigSchema = z.object({
  sections: z
    .array(
      z.object({
        id: z.enum(['education', 'research', 'publications', 'projects', 'awards']),
        order: z.number().int().min(1),
        visible: z.boolean(),
      }),
    )
    .min(1),
});

const localeConfigSchema = z.object({
  code: z.string().min(2),
  short: z.string().min(2),
  name: z.string().min(1),
  dir: z.enum(['ltr', 'rtl']),
  isDefault: z.boolean(),
  enabled: z.boolean(),
});

// ---------- 类型导出 ----------

export type Profile = z.infer<typeof profileSchema>;
export type Education = z.infer<typeof educationSchema>;
export type ResearchInterest = z.infer<typeof researchSchema>;
export type Publication = z.infer<typeof publicationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Award = z.infer<typeof awardSchema>;
export type SectionConfig = z.infer<typeof sectionsConfigSchema>['sections'][number];
export type LocaleConfig = z.infer<typeof localeConfigSchema>;
export type UiDict = Record<string, string>;

export interface SiteData {
  locale: LocaleConfig;
  ui: UiDict;
  sections: SectionConfig[];
  profile: Profile;
  education: Education[];
  research: ResearchInterest[];
  publications: Publication[];
  projects: Project[];
  awards: Award[];
}

// ---------- 文件读取（glob：文件不存在时不会导致模块加载失败） ----------

// 骨架配置始终必需，直接导入
const localesConfig = z.array(localeConfigSchema).parse((await import('./locales.config.json')).default);
const sectionsConfig = sectionsConfigSchema.parse(
  (await import('../content/sections.config.json')).default,
);

// 各语言内容文件与文案字典通过 glob 读取：文件缺失不阻断模块加载，
// 由下方完整性门禁按 enabled 状态决定报错或跳过
const contentModules = import.meta.glob('../content/*/*.json', {
  eager: true,
  import: 'default',
});
const uiModules = import.meta.glob('./ui.*.json', { eager: true, import: 'default' });

const REQUIRED_CONTENT_FILES = ['profile', 'education', 'research', 'publications', 'projects', 'awards'] as const;

function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown, fileLabel: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `    - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`[i18n] 内容文件 ${fileLabel} 校验失败：\n${issues}`);
  }
  return result.data;
}

function ensureUniqueIds(items: Array<{ id: string }>, fileLabel: string) {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw new Error(`[i18n] ${fileLabel} 中存在重复 id："${item.id}"（id 在同一语言文件内必须唯一）`);
    }
    seen.add(item.id);
  }
}

/** 已启用语言的完整站点数据（构建期校验 + 缓存） */
const cache = new Map<string, SiteData>();

export function getSiteData(localeShort: string): SiteData {
  const cached = cache.get(localeShort);
  if (cached) return cached;

  const locale = localesConfig.find((l) => l.short === localeShort);
  if (!locale) {
    throw new Error(`[i18n] locales.config.json 中未注册语言："${localeShort}"`);
  }
  if (!locale.enabled) {
    throw new Error(`[i18n] 语言 "${localeShort}" 已被禁用（enabled: false），不应被渲染`);
  }

  // 界面文案字典
  const uiRaw = (uiModules as Record<string, unknown>)[`./ui.${localeShort}.json`];
  if (uiRaw === undefined) {
    throw new Error(
      `[i18n] 已启用语言 "${localeShort}" 缺少界面文案文件：src/i18n/ui.${localeShort}.json`,
    );
  }
  const ui = parseOrThrow(
    z.record(z.string()),
    uiRaw,
    `src/i18n/ui.${localeShort}.json`,
  ) as UiDict;

  // 内容文件（5 个，缺一即构建失败）
  const content: Record<string, unknown> = {};
  for (const name of REQUIRED_CONTENT_FILES) {
    const key = `../content/${localeShort}/${name}.json`;
    const raw = (contentModules as Record<string, unknown>)[key];
    if (raw === undefined) {
      throw new Error(
        `[i18n] 已启用语言 "${localeShort}" 缺少内容文件：src/content/${localeShort}/${name}.json\n` +
          `  （若该语言内容尚未就绪，可在 src/i18n/locales.config.json 中将其 enabled 置为 false）`,
      );
    }
    content[name] = raw;
  }

  const profile = parseOrThrow(profileSchema, content.profile, `src/content/${localeShort}/profile.json`);
  const education = parseOrThrow(
    z.array(educationSchema),
    content.education,
    `src/content/${localeShort}/education.json`,
  );
  const research = parseOrThrow(
    z.array(researchSchema),
    content.research,
    `src/content/${localeShort}/research.json`,
  );
  const publications = parseOrThrow(
    z.array(publicationSchema),
    content.publications,
    `src/content/${localeShort}/publications.json`,
  );
  const projects = parseOrThrow(
    z.array(projectSchema),
    content.projects,
    `src/content/${localeShort}/projects.json`,
  );
  const awards = parseOrThrow(
    z.array(awardSchema),
    content.awards,
    `src/content/${localeShort}/awards.json`,
  );

  ensureUniqueIds(education, `src/content/${localeShort}/education.json`);
  ensureUniqueIds(research, `src/content/${localeShort}/research.json`);
  ensureUniqueIds(publications, `src/content/${localeShort}/publications.json`);
  ensureUniqueIds(projects, `src/content/${localeShort}/projects.json`);
  ensureUniqueIds(awards, `src/content/${localeShort}/awards.json`);

  const data: SiteData = {
    locale,
    ui,
    sections: [...sectionsConfig.sections].sort((a, b) => a.order - b.order),
    profile,
    education,
    research,
    publications,
    projects,
    awards,
  };
  cache.set(localeShort, data);
  return data;
}

/** 翻译函数：读取 ui 字典，缺失 key 时回退为 key 本身并在构建期给出提示 */
export function makeT(ui: UiDict) {
  return (key: string): string => {
    const v = ui[key];
    if (v === undefined) {
      console.warn(`[i18n] 界面文案缺少 key："${key}"`);
      return key;
    }
    return v;
  };
}

export const ENABLED_LOCALES = localesConfig.filter((l) => l.enabled);
export const DEFAULT_LOCALE = localesConfig.find((l) => l.isDefault) ?? localesConfig[0];

// ---------- 日期本地化 ----------

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(value: string, localeShort: string, presentLabel: string): string {
  if (value === 'present') return presentLabel;
  const [y, m] = value.split('-');
  if (!m) return y;
  if (localeShort === 'zh') return `${y}年${Number(m)}月`;
  return `${EN_MONTHS[Number(m) - 1]} ${y}`;
}

export function formatPeriod(
  start: string,
  end: string,
  localeShort: string,
  presentLabel: string,
): string {
  return `${formatDate(start, localeShort, presentLabel)} – ${formatDate(end, localeShort, presentLabel)}`;
}
