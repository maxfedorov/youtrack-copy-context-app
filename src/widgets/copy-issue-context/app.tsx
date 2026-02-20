/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import Checkbox from '@jetbrains/ring-ui-built/components/checkbox/checkbox';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import {extractResult, safe, humanDate, bytesToSize, copyToClipboard, wrapInCodeBlock, extractComments} from '../shared/utils';
import type {UserRef, ProjectRef, TagRef, AttachmentRef, ActivityItem} from '../shared/utils';

// Register widget in YouTrack. To learn more, see https://www.jetbrains.com/help/youtrack/devportal-apps/apps-host-api.html
const host = await YTApp.register();

// ---- Types ----
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

  const comments = useMemo(() => extractComments(activities), [activities]);

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
      lines.push('', '## Description', '', wrapInCodeBlock(issue.description, 'markdown'));
    }

    if (options.tags && Array.isArray(issue.tags) && issue.tags.length > 0) {
      const tagsStr = issue.tags.map(t => t?.name).filter(Boolean).join(', ');
      if (tagsStr) {
        lines.push('', '## Tags', '', tagsStr);
      }
    }

    if (options.fields && Array.isArray(issue.fields) && issue.fields.length > 0) {
      const fieldLines: string[] = [];
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
            fieldLines.push(`- ${name}: ${valueText}`);
          }
        } catch { /* skip field */ }
      });
      if (fieldLines.length > 0) {
        lines.push('', '## Fields', '', ...fieldLines);
      }
    }

    if (options.attachments && Array.isArray(issue.attachments) && issue.attachments.length > 0) {
      const attachmentLines: string[] = [];
      issue.attachments.forEach(att => {
        try {
          const href = att.url || '';
          const size = bytesToSize(att.size);
          attachmentLines.push(`- [${att.name || 'file'}](${href})${size ? ` (${size})` : ''}`);
        } catch { /* skip */ }
      });
      if (attachmentLines.length > 0) {
        lines.push('', '## Attachments', '', ...attachmentLines);
      }
    }

    if (options.links && Array.isArray(links) && links.length > 0) {
      const linkLines: string[] = [];
      links.forEach(link => {
        try {
          const dir = (link.direction || '').toUpperCase();
          const ltype = link.linkType || {} as LinkType;
          const label = dir === 'INWARD' ? (ltype.localizedTargetToSource || ltype.targetToSource || ltype.localizedName || ltype.name) : (ltype.localizedSourceToTarget || ltype.sourceToTarget || ltype.localizedName || ltype.name);
          const related = (link.issues || []).map(i => `${i.idReadable}${i.summary ? ` — ${i.summary}` : ''}`).filter(Boolean).join(', ');
          if (label && related) {
            linkLines.push(`- ${label}: ${related}`);
          }
        } catch { /* skip */ }
      });
      if (linkLines.length > 0) {
        lines.push('', '## Links', '', ...linkLines);
      }
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
  }, [issue, links, comments, options]);

  const handleCopy = useCallback(async () => {
    try {
      // 1) Save user settings
      try {
        await host.fetchApp('backend-global/user-settings', { method: 'POST', body: { settings: options } });
      } catch { /* ignore */ }

      // 2) Copy
      const ok = await copyToClipboard(markdown);
      if (ok) {
        host.alert('Context copied to clipboard', 'success');
        host.closeWidget();
      } else {
        host.alert('Failed to copy context', 'error');
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
      <Text info>Select the issue details you want to include in the Markdown output:</Text>

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

      <div className="widget__security-note">
        <Text info>
          Please review the copied content before sharing it.
        </Text>
      </div>

      <div className="widget__actions">
        <Button primary onClick={handleCopy}>Copy</Button>
        <Button onClick={() => host.closeWidget()}>Cancel</Button>
      </div>
    </div>
  );
};

export const App = memo(AppComponent);
