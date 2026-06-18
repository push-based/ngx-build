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
            <p className={styles.eyebrow}>Push-Based build tooling</p>
            <Heading as="h1" className={styles.title}>
              ngx-build
            </Heading>
            <p className={styles.subtitle}>
              Documentation for Angular chunk optimization, setup paths, and
              package workflows.
            </p>
            <div className={styles.actions}>
              <Link
                className={clsx(
                  'button button--primary button--lg',
                  styles.action
                )}
                to="/docs/setup"
              >
                Setup
              </Link>
              <Link
                className={clsx(
                  'button button--secondary button--lg',
                  styles.action
                )}
                to="/docs/setup/nx"
              >
                Nx setup
              </Link>
            </div>
          </div>
          <div className={styles.visual} aria-hidden="true">
            <div className={styles.panel}>
              <span>Setup paths</span>
              <strong>Angular CLI setup</strong>
              <strong>Nx Workspace setup</strong>
              <strong>esbuild plugin configuration</strong>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
