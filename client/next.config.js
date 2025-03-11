/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Enable cross-origin loading of chunks
    assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '',
    // Allow loading from any hostname during development
    experimental: {
        // Disable optimizeCss since it's causing issues
        optimizeCss: false,
        scrollRestoration: true,
    },
    // Configure output to handle cross-origin requests
    output: 'standalone',
    eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: true,
    },
    // Ensure webpack properly handles asset loading
    webpack: (config, { isServer, dev }) => {
        if (!isServer && dev) {
            // Add CORS headers to asset requests
            config.output.crossOriginLoading = 'anonymous';
        }
        return config;
    },
}

module.exports = nextConfig