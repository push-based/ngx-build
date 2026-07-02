import type { Config } from '@docusaurus/types';
import type {
  Options as PresetOptions,
  ThemeConfig,
} from '@docusaurus/preset-classic';

const config: Config = {
  title: 'ngx-build',
  tagline: 'Build tooling and experiments for Angular package workflows.',
  favicon: 'img/logo.svg',

  url: 'https://ngx-build.local',
  baseUrl: '/',

  organizationName: 'push-based',
  projectName: 'ngx-build',
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies PresetOptions,
    ],
  ],

  themeConfig: {
    image: 'img/logo.svg',
    navbar: {
      title: 'ngx-build',
      logo: {
        alt: 'ngx-build logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/push-based/ngx-build',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Setup',
              to: '/docs/setup',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ngx-build.`,
    },
    prism: {
      theme: require('prism-react-renderer').themes.github,
      darkTheme: require('prism-react-renderer').themes.dracula,
    },
  } satisfies ThemeConfig,
};

export default config;
