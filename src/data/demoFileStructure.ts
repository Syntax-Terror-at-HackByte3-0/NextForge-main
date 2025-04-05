
import { FileNode } from "@/types/conversion";

// Example structure for demonstration
export const demoFileStructure: FileNode = {
  name: 'my-nextjs-app',
  path: '/',
  type: 'directory',
  children: [
    {
      name: 'pages',
      path: '/pages',
      type: 'directory',
      children: [
        {
          name: '_app.js',
          path: '/pages/_app.js',
          type: 'file',
          content: `import '../styles/globals.css';
import Layout from '../components/Layout';

function MyApp({ Component, pageProps }) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}

export default MyApp;`
        },
        {
          name: 'index.js',
          path: '/pages/index.js',
          type: 'file',
          content: `import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>NextForge App</title>
        <meta name="description" content="Converted from React" />
      </Head>
      <main>
        <h1>Welcome to NextForge</h1>
        <p>This was converted from a React application</p>
      </main>
    </>
  );
}`
        }
      ]
    },
    {
      name: 'components',
      path: '/components',
      type: 'directory',
      children: [
        {
          name: 'Layout.js',
          path: '/components/Layout.js',
          type: 'file',
          content: `import Navbar from './Navbar';
import Footer from './Footer';

export default function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}`
        },
        {
          name: 'Navbar.js',
          path: '/components/Navbar.js',
          type: 'file',
          content: `import Link from 'next/link';

export default function Navbar() {
  return (
    <nav>
      <div className="logo">
        <h1>NextForge</h1>
      </div>
      <div className="links">
        <Link href="/">Home</Link>
      </div>
    </nav>
  );
}`
        }
      ]
    },
    {
      name: 'styles',
      path: '/styles',
      type: 'directory',
      children: [
        {
          name: 'globals.css',
          path: '/styles/globals.css',
          type: 'file',
          content: `html,
body {
  padding: 0;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
    Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

* {
  box-sizing: border-box;
}`
        }
      ]
    },
    {
      name: 'package.json',
      path: '/package.json',
      type: 'file',
      content: `{
  "name": "nextforge-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "12.2.0",
    "react": "18.2.0",
    "react-dom": "18.2.0"
  }
}`
    },
    {
      name: 'next.config.js',
      path: '/next.config.js',
      type: 'file',
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig`
    }
  ]
};
