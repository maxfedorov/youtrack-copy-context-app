/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import Checkbox from '@jetbrains/ring-ui-built/components/checkbox/checkbox';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';
import Text from '@jetbrains/ring-ui-built/components/text/text';

// Register widget in YouTrack. To learn more, see https://www.jetbrains.com/help/youtrack/devportal-apps/apps-host-api.html
const host = await YTApp.register();

// ---- Types ----
interface UserRef { login?: string; fullName?: string }
interface ProjectRef { shortName?: string; name?: string }
interface TagRef { name?: string }
interface AttachmentRef { id?: string; name?: string; url?: string; size?: number; mimeType?: string; created?: number; author?: UserRef }

interface ArticleData {
  id?: string;
  idReadable?: string;
  summary?: string;
  content?: string;
  reporter?: UserRef | null;
  created?: number;
  project?: ProjectRef | null;
  tags?: TagRef[];
  attachments?: AttachmentRef[];
}

interface ActivityItem { author?: UserRef; timestamp?: number; category?: { id?: string }; added?: any; removed?: any }

// ---- Utils ----
const extractResult = (response: unknown): any => {
  if (response && typeof response === 'object' && 'result' in (response as object)) {
    return (response as any).result;
  }
  return response;
};

function safe<T>(val: T | undefined | null, def: T): T { return (val === undefined || val === null ? def : val); }

function humanDate(ts?: number): string {
  if (!ts) { return ''; }
  try {
    return new Date(ts).toISOString();
  } catch {
    return '';
  }
}

function bytesToSize(bytes?: number): string {
  const b = bytes || 0;
  if (b === 0) { return '0 B'; }
  const k = 1024;
  const DECIMALS = 2;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(DECIMALS)} ${sizes[i]}`;
}

function copyToClipboard(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return ok;
  } catch {
    return false;
  }
}

// ---- Options ----
// Keep the same shape as the Issue widget to preserve cross-widget user preferences
const defaultOptions = {
  id: true,
  summary: true,
  description: true, // used as "Content" for articles
  project: true,
  reporter: false,
  created: false,
  tags: false,
  fields: false,      // not used in article UI, preserved for compatibility
  attachments: false,
  links: false,       // not used in article UI, preserved for compatibility
  comments: false
};

type Options = typeof defaultOptions;

// ---- Main Component ----
const AppComponent: React.FunctionComponent = () => {
  const [options, setOptions] = useState<Options>(defaultOptions);
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user settings first
  useEffect(() => {
    (async () => {
      try {
        const settingsResp = await host.fetchApp('backend-global/user-settings', {});
        const settings = extractResult(settingsResp) as { settings?: Partial<Options> };
        if (settings && settings.settings) {
          setOptions(prev => ({...prev, ...settings.settings}));
        }
      } catch {
        // ignore errors
      }
    })();
  }, []);

  // Load article data and activities
  useEffect(() => {
    async function loadData() {
      try {
        const articleId = YTApp.entity?.id;
        if (!articleId) {
          setError('No article context found');
          setLoading(false);
          return;
        }

        const articleFields = [
          'id','idReadable','summary','content',
          'reporter(login,fullName)','created',
          'project(shortName,name)',
          'tags(name)',
          'attachments(id,name,url,size,mimeType,created,author(login,fullName))'
        ].join(',');

        const commentCategories = [
          'CommentsCategory','CommentTextCategory','ArticleCommentsCategory','CommentAttachmentsCategory',
          'CommentReactionCategory','CommentTemporarilyDeletedCategory','CommentVisibilityCategory'
        ].join(',');

        const [articleData, activitiesData] = await Promise.all([
          host.fetchYouTrack(`articles/${articleId}?fields=${articleFields}`),
          host.fetchYouTrack(`articles/${articleId}/activitiesPage?categories=${commentCategories}&fields=activities(author(login,fullName),timestamp,category(id),added(text,$type),removed(text,$type))`)
        ]);

        setArticle(extractResult(articleData) as ArticleData);
        const activitiesPage = extractResult(activitiesData) as { activities?: ActivityItem[] };
        setActivities(activitiesPage?.activities || []);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('Failed to load article context', e);
        setError(e?.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const toggleOption = useCallback((key: keyof Options) => {
    setOptions(prev => ({...prev, [key]: !prev[key]}));
  }, []);

  const comments = useMemo(() => {
    const res: { author?: string; text?: string; timestamp?: number }[] = [];
    activities.forEach(act => {
      try {
        const isCommentCat = (act.category?.id || '').toLowerCase().includes('comment');
        if (!isCommentCat) { return; }
        const author = act.author?.fullName || act.author?.login || '';
        const extractText = (val: any): string[] => {
          if (!val) { return []; }
          const arr = Array.isArray(val) ? val : [val];
          return arr.map(v => {
            if (!v) { return ''; }
            if (typeof v === 'string') { return v; }
            if (typeof v === 'object' && 'text' in v && typeof (v as any).text === 'string') { return (v as any).text; }
            return '';
          }).filter(Boolean);
        };
        const texts = [...extractText(act.added), ...extractText(act.removed)];
        texts.forEach(t => res.push({author, text: t, timestamp: act.timestamp}));
      } catch { /* ignore item */ }
    });
    return res;
  }, [activities]);

  const markdown = useMemo(() => {
    if (!article) { return ''; }
    const lines: string[] = [];

    const titleParts: string[] = [];
    if (options.id && article.idReadable) {
      titleParts.push(article.idReadable);
    }
    if (options.summary && article.summary) {
      titleParts.push(article.summary);
    }
    if (titleParts.length > 0) {
      lines.push(`# ${titleParts.join(' — ')}`.trim());
    }

    if (options.project && article.project) {
      lines.push(`Project: ${safe(article.project.shortName, article.project.name || '')}`.trim());
    }

    if (options.reporter && article.reporter) {
      lines.push(`Reporter: ${article.reporter.fullName || article.reporter.login || ''}`.trim());
    }

    if (options.created && article.created) {
      lines.push(`Created: ${humanDate(article.created)}`);
    }

    if (options.description && article.content) {
      lines.push('', '## Content', '', article.content.trim());
    }

    if (options.tags && Array.isArray(article.tags) && article.tags.length > 0) {
      const tagsStr = article.tags.map(t => t?.name).filter(Boolean).join(', ');
      if (tagsStr) {
        lines.push('', '## Tags', '', tagsStr);
      }
    }

    if (options.attachments && Array.isArray(article.attachments) && article.attachments.length > 0) {
      lines.push('', '## Attachments', '');
      article.attachments.forEach(att => {
        try {
          const href = att.url || '';
          const size = bytesToSize(att.size);
          lines.push(`- [${att.name || 'file'}](${href})${size ? ` (${size})` : ''}`);
        } catch { /* skip */ }
      });
    }

    if (options.comments && comments.length > 0) {
      lines.push('', '## Comments', '');
      comments.forEach(c => {
        try {
          if (!c.text) { return; }
          const author = c.author || 'User';
          const date = c.timestamp ? ` (${humanDate(c.timestamp)})` : '';
          lines.push(`**${author}**${date}:`);
          const quotedText = c.text.split('\n').map(l => `> ${l}`).join('\n');
          lines.push(quotedText, '');
        } catch { /* skip */ }
      });
    }

    return lines.join('\n').trim();
  }, [article, comments, options]);

  const handleCopy = useCallback(async () => {
    try {
      // 1) Save user settings (preserve cross-widget keys)
      try {
        await host.fetchApp('backend-global/user-settings', { method: 'POST', body: { settings: options } });
      } catch { /* ignore */ }

      // 2) Copy
      const ok = copyToClipboard(markdown);
      if (ok) {
        host.alert('Context copied to clipboard', (host as any).AlertType?.SUCCESS || 'success');
        host.closeWidget();
      } else {
        host.alert('Failed to copy context', (host as any).AlertType?.ERROR || 'error');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Copy failed', e);
      host.alert('Error during copying');
    }
  }, [options, markdown]);

  if (loading) {
    return (
      <div className="widget"><LoaderInline/></div>
    );
  }

  if (error) {
    return (
      <div className="widget"><Text>{`Error: ${error}`}</Text></div>
    );
  }

  // Only show relevant checkboxes for articles
  const items: { key: keyof Options; label: string }[] = [
    {key: 'id', label: 'ID'},
    {key: 'summary', label: 'Summary'},
    {key: 'description', label: 'Content'},
    {key: 'project', label: 'Project'},
    {key: 'reporter', label: 'Reporter'},
    {key: 'created', label: 'Created'},
    {key: 'tags', label: 'Tags'},
    {key: 'attachments', label: 'Attachments'},
    {key: 'comments', label: 'Comments'}
  ];

  return (
    <div className="widget">
      <Text info>Select the article details you want to include in the Markdown output:</Text>

      <div className="widget__checkbox-group">
        {items.map(it => (
          <Checkbox
            key={it.key as string}
            label={it.label}
            checked={options[it.key]}
            onChange={() => toggleOption(it.key)}
          />
        ))}
      </div>

      <div className="widget__actions">
        <Button primary onClick={handleCopy}>Copy</Button>
        <Button onClick={() => host.closeWidget()}>Cancel</Button>
      </div>
    </div>
  );
};

export const App = memo(AppComponent);
