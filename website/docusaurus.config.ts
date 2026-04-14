import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Penpal',
  tagline: 'An operating system for running an AI workforce',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://therealsiege.github.io',
  baseUrl: '/Penpal/',

  organizationName: 'therealsiege',
  projectName: 'Penpal',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',

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
          editUrl: 'https://github.com/therealsiege/Penpal/tree/main/website/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/therealsiege/Penpal/tree/main/website/',
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/penpal-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Penpal',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/therealsiege/Penpal',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Getting Started', to: '/docs/intro' },
            { label: 'Pod Workflows', to: '/docs/pods' },
            { label: 'Fleet', to: '/docs/fleet' },
          ],
        },
        {
          title: 'Product',
          items: [
            { label: '1Putt Health', href: 'https://1putthealth.com' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'Blog', to: '/blog' },
            { label: 'GitHub', href: 'https://github.com/therealsiege/Penpal' },
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} 1Putt Health, Inc. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
