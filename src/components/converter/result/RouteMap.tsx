
import React from 'react';
import { Route } from 'lucide-react';
import { ConversionResult } from '@/types/conversion';

interface RouteMapProps {
  conversionResult?: ConversionResult;
}

const RouteMap = ({ conversionResult }: RouteMapProps) => {
  if (!conversionResult || !conversionResult.logs) {
    return null;
  }
  
  // Extract routes from pages
  const routes = Object.keys(conversionResult.pages || {}).map(pagePath => {
    let routePath = '/' + pagePath.replace(/\.(js|jsx|ts|tsx)$/, '');
    
    // Convert index to root path
    if (routePath.endsWith('/index')) {
      routePath = routePath.replace(/\/index$/, '') || '/';
    }
    
    // Handle dynamic routes
    routePath = routePath.replace(/\[([^\]]+)\]/g, ':$1');
    
    return {
      path: routePath,
      component: pagePath
    };
  });
  
  if (routes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Route className="w-12 h-12 mb-4 opacity-30" />
        <p>No routes found in the conversion</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Next.js Routes</h3>
      <div className="border rounded-md overflow-hidden">
        <div className="bg-secondary/30 p-3 border-b flex items-center gap-2">
          <Route className="w-4 h-4" />
          <span className="font-medium">Route Map</span>
        </div>
        <div className="p-4">
          <table className="w-full">
            <thead className="text-xs text-left border-b">
              <tr>
                <th className="py-2 px-3 font-medium">Route Path</th>
                <th className="py-2 px-3 font-medium">Page Component</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {routes.map((route, index) => (
                <tr key={index} className="border-b last:border-0">
                  <td className="py-2 px-3 font-mono">{route.path}</td>
                  <td className="py-2 px-3 opacity-70">{route.component}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-secondary/10 rounded-md p-4 text-sm">
        <p className="font-medium mb-2">About Next.js Routing</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Next.js uses a file-system based router</li>
          <li>Files in the <code>pages</code> directory automatically become routes</li>
          <li>Dynamic routes use <code>[param]</code> syntax in filenames</li>
          <li>Nested routes follow the folder structure</li>
        </ul>
      </div>
    </div>
  );
};

export default RouteMap;
