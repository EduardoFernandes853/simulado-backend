import { config } from './config';
import { criarApp } from './app';

criarApp().listen(config.PORT, () => {
  console.log(`API no ar na porta ${config.PORT}`);
});