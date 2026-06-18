import clsx from 'clsx';
import Heading from '@theme/Heading';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import styles from './index.module.css';

export default function Home() {
  return (
    <Layout
      title="Documentation"
      description="Documentation for ngx-build tooling and experiments"
    >
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Nx integrated documentation</p>
            <Heading as="h1" className={styles.title}>
              ngx-build
            </Heading>
            <p className={styles.subtitle}>
              Build notes, package workflows, and bundling experiments in one
              TypeScript Docusaurus site.
            </p>
            <div className={styles.actions}>
              <Link
                className={clsx('button button--primary button--lg', styles.action)}
                to="/docs/intro"
              >
                Open docs
              </Link>
              <Link
                className={clsx('button button--secondary button--lg', styles.action)}
                to="/docs/intro"
              >
                Nx targets
              </Link>
            </div>
          </div>
          <div className={styles.visual} aria-hidden="true">
            <div className={styles.panel}>
              <span>apps/docs</span>
              <strong>docs:build</strong>
              <strong>docs:serve</strong>
              <strong>docs:typecheck</strong>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
