const fs = require("fs");
const path = require("path");

const sourceDir = path.join(__dirname, "../src/assets/icon");
const androidResDir = path.join(__dirname, "../android/app/src/main/res");

const targets = [
  { src: "splash.png", dest: "drawable/splash.png" },
  { src: "splash.png", dest: "drawable-land-mdpi/splash.png" },
  { src: "splash.png", dest: "drawable-land-hdpi/splash.png" },
  { src: "splash.png", dest: "drawable-land-xhdpi/splash.png" },
  { src: "splash.png", dest: "drawable-land-xxhdpi/splash.png" },
  { src: "splash.png", dest: "drawable-land-xxxhdpi/splash.png" },
  { src: "splash.png", dest: "drawable-port-mdpi/splash.png" },
  { src: "splash.png", dest: "drawable-port-hdpi/splash.png" },
  { src: "splash.png", dest: "drawable-port-xhdpi/splash.png" },
  { src: "splash.png", dest: "drawable-port-xxhdpi/splash.png" },
  { src: "splash.png", dest: "drawable-port-xxxhdpi/splash.png" },
];

targets.forEach((target) => {
  const fromPath = path.join(sourceDir, target.src);
  const toPath = path.join(androidResDir, target.dest);
  const toDir = path.dirname(toPath);

  if (fs.existsSync(fromPath)) {
    if (!fs.existsSync(toDir)) {
      fs.mkdirSync(toDir, { recursive: true });
    }
    fs.copyFileSync(fromPath, toPath);
  }
});

console.log("Splash setup done!");
