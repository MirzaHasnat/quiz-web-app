#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendPath = path.join(__dirname, 'frontend');
const backendPath = path.join(__dirname, 'backend');
const buildPath = path.join(frontendPath, 'build');

console.log('🚀 Starting integrated app server...\n');

// Function to run command and return promise
function runCommand(command, cwd, description) {
  return new Promise((resolve, reject) => {
    console.log(`📦 ${description}...`);
    
    const child = exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error in ${description}:`, error.message);
        reject(error);
        return;
      }
      
      if (stderr && !stderr.includes('warning')) {
        console.error(`⚠️  ${description} stderr:`, stderr);
      }
      
      console.log(`✅ ${description} completed\n`);
      resolve(stdout);
    });

    // Show real-time output for build process
    child.stdout?.on('data', (data) => {
      process.stdout.write(data);
    });
  });
}

// Function to check if build exists and is recent
function shouldRebuild() {
  if (!fs.existsSync(buildPath)) {
    return true;
  }
  
  const buildStat = fs.statSync(buildPath);
  const packageStat = fs.statSync(path.join(frontendPath, 'package.json'));
  
  // Rebuild if package.json is newer than build directory
  return packageStat.mtime > buildStat.mtime;
}

async function main() {
  try {
    // Check if we need to rebuild
    if (shouldRebuild()) {
      console.log('🔨 Building frontend...');
      await runCommand('npm run build', frontendPath, 'Frontend build');
    } else {
      console.log('✅ Frontend build is up to date, skipping build step\n');
    }

    // Set production environment
    process.env.NODE_ENV = 'production';
    
    console.log('🌐 Starting backend server in production mode...');
    console.log('📍 Frontend will be served at: http://localhost:5001');
    console.log('📍 API endpoints available at: http://localhost:5001/api/*\n');
    
    // Start backend server
    const server = spawn('node', ['server.js'], {
      cwd: backendPath,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });

    // Handle server process events
    server.on('error', (error) => {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    });

    server.on('close', (code) => {
      console.log(`\n🛑 Server process exited with code ${code}`);
      process.exit(code);
    });

    // Handle script termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...');
      server.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down server...');
      server.kill('SIGTERM');
    });

  } catch (error) {
    console.error('❌ Failed to start application:', error.message);
    process.exit(1);
  }
}

main();