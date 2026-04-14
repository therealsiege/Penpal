import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Features() {
  return (
    <section style={{padding: '4rem 0'}}>
      <div className="container">
        <div className="row">
          <div className="col col--4">
            <div style={{textAlign: 'center', padding: '1rem'}}>
              <h3>Manage Operations</h3>
              <p>See every AI agent across your machines. Focus terminals, communicate via Slack, get DM'd when agents need help.</p>
            </div>
          </div>
          <div className="col col--4">
            <div style={{textAlign: 'center', padding: '1rem'}}>
              <h3>Background Work</h3>
              <p>Label a GitHub issue, walk away, come back to a PR. Configurable agent pods with cloud or local models.</p>
            </div>
          </div>
          <div className="col col--4">
            <div style={{textAlign: 'center', padding: '1rem'}}>
              <h3>RPG Game Layer</h3>
              <p>Agents are characters from Journey to the West. Pods are quests. XP, seasons, leaderboards make work visible.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="AI Workforce OS"
      description="An operating system for running an AI workforce. Orchestrate coding agents, manage pods, visualize work in an RPG game world.">
      <HomepageHeader />
      <main>
        <Features />
      </main>
    </Layout>
  );
}
