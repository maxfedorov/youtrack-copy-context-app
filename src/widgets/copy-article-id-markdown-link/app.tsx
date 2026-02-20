import React, {memo} from 'react';
import {CopyMarkdownLinkWidget} from '../../shared/CopyMarkdownLinkWidget';
import './app.css';

const host = await YTApp.register();

const AppComponent: React.FunctionComponent = () => (
  <CopyMarkdownLinkWidget host={host} infoEndpoint="backend/get-article-info"/>
);

export const App = memo(AppComponent);
