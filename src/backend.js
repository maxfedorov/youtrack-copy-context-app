exports.httpHandler = {
  endpoints: [
    {
      scope: 'issue',
      method: 'GET',
      path: 'get-issue-info',
      handle: function handle(ctx) {
        const issue = ctx.issue;
        ctx.response.json({
          id: issue.id || '',
          url: issue.url || '',
          summary: issue.summary || ''
        });
      }
    },
    {
      scope: 'issue',
      method: 'GET',
      path: 'get-template',
      handle: function handle(ctx) {
        const template = ctx.settings?.template || '';
        ctx.response.json({
          template: template
        });
      }
    },
    {
      scope: 'article',
      method: 'GET',
      path: 'get-article-info',
      handle: function handle(ctx) {
        const article = ctx.article;
        ctx.response.json({
          id: article.id || '',
          url: article.url || '',
          summary: article.summary || ''
        });
      }
    },
    {
      scope: 'article',
      method: 'GET',
      path: 'get-template',
      handle: function handle(ctx) {
        const template = ctx.settings?.template || '';
        ctx.response.json({
          template: template
        });
      }
    }
  ]
};
