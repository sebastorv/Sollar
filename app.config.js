// Configuración dinámica: toma app.json y, para publicar la web en una subcarpeta
// (por ejemplo GitHub Pages en /sollar), agrega la ruta base desde WEB_BASE.
module.exports = ({ config }) => {
  const base = process.env.WEB_BASE;
  if (!base) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl: base } };
};
