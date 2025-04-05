
const Instructions = () => {
  return (
    <div className="max-w-3xl mx-auto mt-12 text-center">
      <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
      <p className="text-muted-foreground mb-6">
        Download your converted Next.js project and follow these steps to run it:
      </p>
      
      <div className="glass rounded-lg p-6 text-left">
        <pre className="code-editor text-sm overflow-auto bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md mb-4">
          <code className="text-foreground">
{`# Install dependencies
npm install

# Run the development server
npm run dev`}
          </code>
        </pre>
        <p className="text-sm text-muted-foreground">
          Your Next.js app will be running at <span className="font-mono bg-secondary/50 px-1.5 py-0.5 rounded text-xs">http://localhost:3000</span>
        </p>
      </div>
    </div>
  );
};

export default Instructions;
