import { validarUrlDeTeste } from './urlTeste';

describe('validarUrlDeTeste', () => {
  it.each([
    'postgresql://postgres:teste@localhost:5432/simulado_teste',
    'postgres://u:p@127.0.0.1/test_db',
    'postgresql://postgres:x@[::1]:5432/meu_teste',
  ])('aceita %s', (url) => expect(() => validarUrlDeTeste(url)).not.toThrow());

  it.each([
    ['o pooler do Supabase', 'postgresql://postgres.abc:segredo@aws-0-sa-east-1.pooler.supabase.com:5432/postgres'],
    ['host remoto com nome de teste', 'postgresql://u:p@db.exemplo.com:5432/simulado_teste'],
    ['host local, mas banco que não é de teste', 'postgresql://postgres:x@localhost:5432/postgres'],
    ['outro protocolo', 'mysql://root:x@localhost:3306/teste'],
    ['texto que não é URL', 'isto não é uma url'],
    ['vazio', ''],
  ])('recusa %s', (_nome, url) => expect(() => validarUrlDeTeste(url)).toThrow());

  it('a mensagem de erro nunca repete a senha', () => {
    try {
      validarUrlDeTeste('postgresql://postgres:SENHA-SECRETA@db.exemplo.com:5432/postgres');
    } catch (e) {
      expect((e as Error).message).not.toContain('SENHA-SECRETA');
      return;
    }
    throw new Error('deveria ter recusado');
  });
});