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

interface IssueField {
  id?: string;
  projectCustomField?: { field?: { name?: string; fieldType?: { valueType?: string } } };
  value?: any; // value may be primitive, object, or array
}

interface IssueData {
  id?: string;
  idReadable?: string;
  summary?: string;
  description?: string;
  reporter?: UserRef | null;
  created?: number;
  project?: ProjectRef | null;
  tags?: TagRef[];
  attachments?: AttachmentRef[];
  fields?: IssueField[];
}

interface LinkType { name?: string; localizedName?: string; sourceToTarget?: string; localizedSourceToTarget?: string; targetToSource?: string; localizedTargetToSource?: string }
interface IssueLink { direction?: string; linkType?: LinkType; issues?: { idReadable?: string; summary?: string }[] }

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

function getBaseUrlFromReferrer(): string {
  try {
    const ref = document.referrer || '';
    const parts = ref.split(/\/(issue|articles|dashboard|admin|projects|users|settings)/);
    return parts[0] || '';
  } catch {
    return '';
  }
}

// ---- Options ----
const defaultOptions = {
  id: true,
  summary: true,
  description: true,
  project: true,
  reporter: false,
  created: false,
  tags: false,
  fields: false,
  attachments: false,
  links: false,
  comments: false
};

type Options = typeof defaultOptions;

// ---- Main Component ----
const AppComponent: React.FunctionComponent = () => {
  const [options, setOptions] = useState<Options>(defaultOptions);
  const [issue, setIssue] = useState<IssueData | null>(null);
  const [links, setLinks] = useState<IssueLink[]>([]);
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

  // Load issue data, links, and activities
  useEffect(() => {
    async function loadData() {
      try {
        const issueId = YTApp.entity?.id;
        if (!issueId) {
          setError('No issue context found');
          setLoading(false);
          return;
        }

        const issueFields = [
          'id','idReadable','summary','description',
          'reporter(login,fullName)','created',
          'project(shortName,name)',
          'tags(name)',
          'attachments(id,name,url,size,mimeType,created,author(login,fullName))',
          'fields(value(id,name,login,fullName,localizedName,presentation,$type),projectCustomField(field(name,fieldType(valueType))))'
        ].join(',');

        const commentCategories = [
          'CommentsCategory','CommentTextCategory','ArticleCommentsCategory','CommentAttachmentsCategory',
          'CommentReactionCategory','CommentTemporarilyDeletedCategory','CommentVisibilityCategory'
        ].join(',');

        const [issueData, linksData, activitiesData] = await Promise.all([
          host.fetchYouTrack(`issues/${issueId}?fields=${issueFields}`),
          host.fetchYouTrack(`issues/${issueId}/links?fields=direction,linkType(name,localizedName,sourceToTarget,localizedSourceToTarget,targetToSource,localizedTargetToSource),issues(idReadable,summary)`),
          host.fetchYouTrack(`issues/${issueId}/activitiesPage?categories=${commentCategories}&fields=activities(author(login,fullName),timestamp,category(id),added(text,$type),removed(text,$type))`)
        ]);

        setIssue(extractResult(issueData) as IssueData);
        setLinks((extractResult(linksData) as IssueLink[]) || []);
        const activitiesPage = extractResult(activitiesData) as { activities?: ActivityItem[] };
        setActivities(activitiesPage?.activities || []);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('Failed to load issue context', e);
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

  const baseUrl = useMemo(() => getBaseUrlFromReferrer(), []);

  const markdown = useMemo(() => {
    if (!issue) { return ''; }
    const lines: string[] = [];

    const titleParts: string[] = [];
    if (options.id && issue.idReadable) {
      titleParts.push(issue.idReadable);
    }
    if (options.summary && issue.summary) {
      titleParts.push(issue.summary);
    }
    if (titleParts.length > 0) {
      lines.push(`# ${titleParts.join(' — ')}`.trim());
    }

    if (options.project && issue.project) {
      lines.push(`Project: ${safe(issue.project.shortName, issue.project.name || '')}`.trim());
    }

    if (options.reporter && issue.reporter) {
      lines.push(`Reporter: ${issue.reporter.fullName || issue.reporter.login || ''}`.trim());
    }

    if (options.created && issue.created) {
      lines.push(`Created: ${humanDate(issue.created)}`);
    }

    if (options.description && issue.description) {
      lines.push('', '## Description', '', issue.description.trim());
    }

    if (options.tags && Array.isArray(issue.tags) && issue.tags.length > 0) {
      const tagsStr = issue.tags.map(t => t?.name).filter(Boolean).join(', ');
      if (tagsStr) {
        lines.push('', '## Tags', '', tagsStr);
      }
    }

    if (options.fields && Array.isArray(issue.fields) && issue.fields.length > 0) {
      lines.push('', '## Fields', '');
      issue.fields.forEach(f => {
        try {
          const name = f.projectCustomField?.field?.name || 'Field';
          const v = f.value;
          const toText = (val: any): string => {
            if (val == null) { return ''; }
            if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') { return String(val); }
            if (Array.isArray(val)) { return val.map(toText).filter(Boolean).join(', '); }
            if (typeof val === 'object') {
              // prefer presentation/name/fullName/login/localizedName
              return (val.presentation || val.name || val.fullName || val.login || val.localizedName || '').toString();
            }
            return '';
          };
          const valueText = toText(v);
          if (valueText) {
            lines.push(`- ${name}: ${valueText}`);
          }
        } catch { /* skip field */ }
      });
    }

    if (options.attachments && Array.isArray(issue.attachments) && issue.attachments.length > 0) {
      lines.push('', '## Attachments', '');
      issue.attachments.forEach(att => {
        try {
          const href = att.url || (baseUrl ? `${baseUrl}/_persistent/${encodeURIComponent(att.name || 'file')}` : '');
          const size = bytesToSize(att.size);
          lines.push(`- [${att.name || 'file'}](${href})${size ? ` (${size})` : ''}`);
        } catch { /* skip */ }
      });
    }

    if (options.links && Array.isArray(links) && links.length > 0) {
      lines.push('', '## Links', '');
      links.forEach(link => {
        try {
          const dir = (link.direction || '').toUpperCase();
          const ltype = link.linkType || {} as LinkType;
          const label = dir === 'INWARD' ? (ltype.localizedTargetToSource || ltype.targetToSource || ltype.localizedName || ltype.name) : (ltype.localizedSourceToTarget || ltype.sourceToTarget || ltype.localizedName || ltype.name);
          const related = (link.issues || []).map(i => `${i.idReadable}${i.summary ? ` — ${i.summary}` : ''}`).filter(Boolean).join(', ');
          if (label && related) {
            lines.push(`- ${label}: ${related}`);
          }
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
  }, [issue, links, comments, options, baseUrl]);

  const handleCopy = useCallback(async () => {
    try {
      // 1) Save user settings
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

  const items: { key: keyof Options; label: string }[] = [
    {key: 'id', label: 'ID'},
    {key: 'summary', label: 'Summary'},
    {key: 'description', label: 'Description'},
    {key: 'project', label: 'Project'},
    {key: 'reporter', label: 'Reporter'},
    {key: 'created', label: 'Created'},
    {key: 'tags', label: 'Tags'},
    {key: 'fields', label: 'Fields'},
    {key: 'attachments', label: 'Attachments'},
    {key: 'links', label: 'Links'},
    {key: 'comments', label: 'Comments'}
  ];

  return (
    <div className="widget">
      <div className="widget__row" style={{display: 'flex', flexDirection: 'column', gap: 8}}>
        {items.map(it => (
          <Checkbox
            key={it.key as string}
            label={it.label}
            checked={options[it.key]}
            onChange={() => toggleOption(it.key)}
          />
        ))}
      </div>
      <div className="widget__row" style={{marginTop: 12, display: 'flex', gap: 8}}>
        <Button primary onClick={handleCopy}>Copy</Button>
        <Button onClick={() => host.closeWidget()}>Cancel</Button>
      </div>
    </div>
  );
};

export const App = memo(AppComponent);
