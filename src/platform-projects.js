import fs from 'node:fs/promises';
import path from 'node:path';

export async function scaffoldPlatformProject(target, root, { name='VelocityProof', applicationId='dev.cannon.velocityproof' } = {}) {
  root = path.resolve(root);
  await fs.rm(root,{recursive:true,force:true}); await fs.mkdir(root,{recursive:true});
  const files = target==='android' ? androidFiles(name,applicationId) : target==='ios' ? iosFiles(name,applicationId) : target==='desktop' ? desktopFiles(name) : null;
  if(!files) throw new Error(`unsupported platform project target: ${target}`);
  for(const [relative,content] of Object.entries(files)){const file=path.join(root,relative);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,content,'utf8');}
  return {target,root,files:Object.keys(files).sort()};
}

function androidFiles(name,id){return {
  'settings.gradle': `pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }\nrootProject.name='${name}'\ninclude ':app'\n`,
  'build.gradle': `plugins { id 'com.android.application' version '8.7.3' apply false }\n`,
  'app/build.gradle': `plugins { id 'com.android.application' }\n\nandroid { namespace '${id}'; compileSdk 35\n defaultConfig { applicationId '${id}'; minSdk 23; targetSdk 35; versionCode 1; versionName '1.0' } }\n`,
  'app/src/main/AndroidManifest.xml': `<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:theme="@style/AppTheme" android:label="${name}"><activity android:name=".MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>\n`,
  'app/src/main/res/values/styles.xml': `<resources><style name="AppTheme" parent="android:style/Theme.Material.Light.NoActionBar"/></resources>\n`,
  ['app/src/main/java/'+id.replaceAll('.','/')+'/MainActivity.java']: `package ${id};\nimport android.app.Activity; import android.os.Bundle; import android.widget.TextView;\npublic class MainActivity extends Activity { public void onCreate(Bundle state){ super.onCreate(state); TextView view=new TextView(this); view.setText("Velocity Android Ready"); view.setContentDescription("velocity-proof"); setContentView(view); } }\n`
};}
function iosFiles(name,id){return {
  'main.swift': `import UIKit\nfinal class AppDelegate: UIResponder, UIApplicationDelegate { var window: UIWindow?; func application(_ application:UIApplication, didFinishLaunchingWithOptions launchOptions:[UIApplication.LaunchOptionsKey:Any]? = nil)->Bool { let window=UIWindow(frame: UIScreen.main.bounds); let controller=UIViewController(); controller.view.backgroundColor = .white; let label=UILabel(frame:CGRect(x:20,y:80,width:320,height:40)); label.text="Velocity iOS Ready"; label.accessibilityIdentifier="velocity-proof"; controller.view.addSubview(label); window.rootViewController=controller; window.makeKeyAndVisible(); self.window=window; return true } }\nUIApplicationMain(CommandLine.argc, CommandLine.unsafeArgv, nil, NSStringFromClass(AppDelegate.self))\n`,
  'Info.plist': `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>${name}</string><key>CFBundleIdentifier</key><string>${id}</string><key>CFBundleName</key><string>${name}</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string><key>UILaunchStoryboardName</key><string></string></dict></plist>\n`
};}
function desktopFiles(name){return {'main.c':`#include <stdio.h>\nint main(void){ puts("Velocity Desktop Ready"); return 0; }\n`,'velocity-desktop.json':JSON.stringify({name,protocol:'velocity-desktop/1'},null,2)+'\n'};}
