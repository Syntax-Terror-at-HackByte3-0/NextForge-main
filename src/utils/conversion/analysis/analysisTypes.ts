
/**
 * Types for component analysis
 */
export type FileType = 'component' | 'page' | 'layout' | 'api' | 'config' | 'style' | 'util' | 'hook' | 'context' | 'reducer' | 'store';
export type ComponentType = 'functional' | 'class' | 'hook' | 'hoc' | 'context' | 'jsx' | 'unknown';
export type RenderingStrategy = 'csr' | 'ssr' | 'ssg' | 'isr';
export type DataFetchingMethod = 'client' | 'getServerSideProps' | 'getStaticProps' | 'getStaticPaths' | 'serverComponent';

export interface AnalysisResult {
  fileType: FileType;
  componentType: ComponentType;
  hasDataFetching: boolean;
  hasRouting: boolean;
  imports: string[];
  exports: string[];
  hasClientSideCode: boolean;
  hasServerSideCode?: boolean;
  dependencies: string[];
  usesHooks: boolean;
  usesContext: boolean;
  usesRedux?: boolean;
  usesStateManagement?: boolean;
  hooks: string[];
  props: string[];
  hasSEO: boolean;
  importsSass?: boolean;
  importsCSS?: boolean;
  usesStyled: boolean;
  isTypescript: boolean;
  routeComponents?: string[]; // For route components tracking
  hasErrorBoundary?: boolean;
  hasSuspense?: boolean;
  usesNextImage?: boolean;
  usesNextLink?: boolean;
  usesNextRouter?: boolean;
  usesNextHead?: boolean;
  hasGetServerSideProps?: boolean;
  hasGetStaticProps?: boolean;
  hasGetStaticPaths?: boolean;
  hasJSX?: boolean;
  jestTests?: boolean;
  cypressTests?: boolean;
  mainComponentName?: string; // Name of the main component in the file
  defaultExport?: string; // Name of the default exported component
  namedExports?: string[]; // Names of named exports
  hasDefaultExport?: boolean; // Whether the file has a default export
  routePatterns?: string[]; // Detected route patterns
  jsxElements?: JSXElementInfo[]; // JSX elements in the file
  isMissingExportDefault?: boolean; // Flag for missing export default
  recommendedRenderingStrategy?: RenderingStrategy; // Recommended rendering strategy based on analysis
  staticDataDependencies?: string[]; // Data that could be statically generated
  dynamicDataDependencies?: string[]; // Data that requires server-side rendering
  detectedAssetOptimizations?: AssetOptimizationInfo[]; // Detected assets that could be optimized
  browserAPIs?: string[]; // Browser APIs used in the component
  stateManagementLibraries?: string[]; // State management libraries used
  thirdPartyDependencies?: ThirdPartyDependencyInfo[]; // Third-party dependencies information
  securityIssues?: SecurityIssue[]; // Potential security issues detected
  performanceIssues?: PerformanceIssue[]; // Potential performance issues detected
}

export interface ProjectAnalysis {
  components: Record<string, AnalysisResult>;
  entryPoints: string[];
  routeConfig?: Record<string, string>;
  dependencies: string[];
  stateManagement: string[];
  cssFrameworks: string[];
  isTypeScript: boolean;
  routes?: Record<string, string>; // For route mapping
  rootLayout?: string; // For App Router layout
  apiEndpoints?: string[]; // API routes
  assets?: string[]; // Static assets
  tests?: string[]; // Test files
  componentCount?: number; // Total number of components
  pageCount?: number; // Total number of pages
  hasTypeScript?: boolean; // Project uses TypeScript
  recommendedNextVersion?: string; // Recommended Next.js version based on features used
  migrationComplexity?: 'simple' | 'moderate' | 'complex'; // Estimated migration complexity
  criticalPathComponents?: string[]; // Components in the critical rendering path
  sharedDependencies?: Record<string, number>; // Frequently shared dependencies
  potentialServerComponents?: string[]; // Components that could be converted to Server Components
  suggestedOptimizations?: MigrationSuggestion[]; // Suggested optimizations
}

export interface JSXElementInfo {
  name: string;
  attributes: Record<string, string | boolean>;
  children?: JSXElementInfo[];
}

export interface ThirdPartyDependencyInfo {
  name: string;
  version?: string;
  isSSRCompatible?: boolean;
  isTreeShakable?: boolean;
  alternatives?: string[];
  size?: number; // in KB
}

export interface AssetOptimizationInfo {
  type: 'image' | 'font' | 'script' | 'style';
  path: string;
  optimizationStrategy: string;
  potentialSavings?: string;
}

export interface SecurityIssue {
  type: 'environment-variable' | 'client-secret' | 'authentication' | 'authorization' | 'api-key';
  severity: 'low' | 'medium' | 'high';
  description: string;
  location?: string;
  suggestion: string;
}

export interface PerformanceIssue {
  type: 'large-bundle' | 'render-blocking' | 'inefficient-data-fetching' | 'unnecessary-client-side';
  impact: 'low' | 'medium' | 'high';
  description: string;
  location?: string;
  suggestion: string;
}

export interface MigrationSuggestion {
  category: 'performance' | 'security' | 'architecture' | 'compatibility';
  description: string;
  benefits: string[];
  effort: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high';
}

export interface ConversionIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  code?: string;
  fix?: string;
}
