import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { hashPassword } from '../lib/auth';

async function passwordInput(): Promise<string> {
  if (!process.stdin.isTTY) {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk.toString();
      if (input.length > 1026) throw new Error('Password input is too long.');
    }
    return input.replace(/\r?\n$/, '');
  }
  // Readline still handles editing while the output sink suppresses every typed character.
  const hiddenOutput = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const input = createInterface({ input: process.stdin, output: hiddenOutput, terminal: true });
  process.stderr.write('New admin password (12+ characters; input hidden): ');
  const password = await new Promise<string>((resolve, reject) => {
    input.once('SIGINT', () => { input.close(); reject(new Error('Cancelled.')); });
    input.question('', resolve);
  });
  input.close();
  process.stderr.write('\nConfirm password: ');
  const confirm = createInterface({ input: process.stdin, output: hiddenOutput, terminal: true });
  const confirmation = await new Promise<string>((resolve, reject) => {
    confirm.once('SIGINT', () => { confirm.close(); reject(new Error('Cancelled.')); });
    confirm.question('', resolve);
  });
  confirm.close();
  process.stderr.write('\n');
  if (password !== confirmation) throw new Error('Passwords did not match.');
  return password;
}

passwordInput().then(hashPassword).then(hash => {
  process.stdout.write(`ADMIN_PASSWORD_HASH=${hash}\n`);
  process.stderr.write('Save this hash in your server environment settings. Keep your password private.\n');
}).catch(error => { process.stderr.write(`${error instanceof Error ? error.message : 'Unable to generate password hash.'}\n`); process.exitCode = 1; });
