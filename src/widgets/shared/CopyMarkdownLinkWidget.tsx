import React, {memo, useCallback, useEffect, useState, useRef} from 'react';
import Input from '@jetbrains/ring-ui-built/components/input/input';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import Tooltip from '@jetbrains/ring-ui-built/components/tooltip/tooltip';
import Icon from '@jetbrains/ring-ui-built/components/icon/icon';
import {ControlsHeight} from '@jetbrains/ring-ui-built/components/global/controls-height';
import copyIcon from '@jetbrains/icons/copy-20px';
import helpIcon from '@jetbrains/icons/help';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';
import type {HostAPI} from '../../../@types/globals.d';
import {fetchEntityAndTemplate} from './utils';
import {copyWithNavigator, copyWithInputRef, copyWithTextarea} from './clipboard';

interface CopyMarkdownLinkWidgetProps {
  host: HostAPI;
  infoEndpoint: string;
}

const CopyMarkdownLinkWidgetComponent: React.FunctionComponent<CopyMarkdownLinkWidgetProps> = ({host, infoEndpoint}) => {
  const [markdownLink, setMarkdownLink] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchEntityAndTemplate(host, infoEndpoint)
      .then(setMarkdownLink)
      // eslint-disable-next-line no-console
      .catch((e: unknown) => console.error('Failed to load entity info', e))
      .finally(() => setLoading(false));
  }, [host, infoEndpoint]);

  const handleCopy = useCallback(async () => {
    const text = markdownLink || '';
    try {
      const ok = (await copyWithNavigator(text)) || copyWithInputRef(inputRef) || copyWithTextarea(text);
      if (ok) {
        host.alert('Link copied to clipboard', 'success');
        host.closeWidget();
      } else {
        host.alert('Failed to copy link', 'error');
      }
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy to clipboard', e);
      host.alert('Failed to copy link', 'error');
    }
  }, [markdownLink, host]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setMarkdownLink(e.target.value);
    },
    []
  );

  if (loading) {
    return (
      <div className="widget">
        <LoaderInline/>
      </div>
    );
  }

  const label = (
    <>
      Markdown link
      <Tooltip title="You can configure the link template in the app settings on the project settings page.">
        <Icon
          glyph={helpIcon}
          color={Icon.Color.GRAY}
          style={{marginLeft: '4px', verticalAlign: 'middle', cursor: 'help'}}
        />
      </Tooltip>
    </>
  );

  return (
    <div className="widget">
      <div className="widget__row">
        <Input
          className="widget__input"
          height={ControlsHeight.M}
          inputRef={inputRef}
          label={label}
          value={markdownLink}
          onChange={handleChange}
        />
        <Button
          height={ControlsHeight.M}
          icon={copyIcon}
          primary
          onClick={handleCopy}
          title="Copy to clipboard"
        />
      </div>
    </div>
  );
};

export const CopyMarkdownLinkWidget = memo(CopyMarkdownLinkWidgetComponent);
