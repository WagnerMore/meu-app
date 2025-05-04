const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3000;

app.use(express.json()); // Permite ler JSON vindo do body
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de automação
app.post('/baixar-dados', async (req, res) => {
  try {
    const os = require('os');
    const fs = require('fs');

    const downloadPath = path.join(os.homedir(), 'Downloads');

    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-fullscreen']
    });

    const pages = await browser.pages();
    const page = pages[0];
    await page.bringToFront();
    
    const dimensions = await page.evaluate(() => {
      return {
        width: window.screen.availWidth,
        height: window.screen.availHeight
      };
    });
    await page.setViewport(dimensions);

    await page.goto('https://web.bndes.gov.br/fg2/#/login?returnUrl=%2Fhome', { waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Tentar clicar no botão "Entendi"
    const lgpdBtn = await page.$('#confirmacao_lgpd, button.cookie__botao');
    if (lgpdBtn) {
      await lgpdBtn.click();
      console.log('Botão "Entendi" clicado.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('Botão "Entendi" não encontrado.');
    }

    // Credenciais: CNPJ fixo, usuário e senha vindos do front-end
    const loginCnpj = '07.237.373/0001-20';
    const { usuario: loginUsuario, senha: loginSenha } = req.body;

    if (!loginUsuario || !loginSenha) {
      return res.status(400).send('Usuário e senha são obrigatórios.');
    }

    // Esperar campo CNPJ e preencher
    try {
      await page.waitForSelector('input[name="log_cnpj"]', { visible: true, timeout: 15000 });
      console.log('Campo CNPJ encontrado!');
      await page.type('input[name="log_cnpj"]', loginCnpj);
    } catch (e) {
      throw new Error('Campo CNPJ não encontrado após 15 segundos.');
    }

    // Preencher login e senha
    await page.type('input[name="log_userName"]', loginUsuario);
    await page.type('input[name="log_senha"]', loginSenha);

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    await page.waitForSelector('p.card-text', { timeout: 10000 });

    // Aguardar até que a página tenha o botão "FGI PEAC"
    await page.waitForSelector('p.card-text', { timeout: 15000 }); // aguarda até qualquer botão card-text aparecer

    const botoesTexto = await page.$$('p.card-text');
    let clicou = false;

    for (const botao of botoesTexto) {
      const texto = await page.evaluate(el => el.textContent, botao);
      if (texto.includes('FGI PEAC')) {
        const botaoPrincipal = await botao.evaluateHandle(el => el.closest('a'));
        await botaoPrincipal.click();
        console.log('Botão "FGI PEAC" clicado com sucesso.');
        clicou = true;
        break;
      }
    }

    if (!clicou) {
      throw new Error('Botão "FGI PEAC" não foi encontrado ou não pôde ser clicado.');
    }

        // Aguarda até que o botão "Operações" esteja disponível no DOM
        await page.waitForFunction(() => {
          const botao = document.evaluate(
            '/html/body/app-root/bn-container/main/app-home/div[1]/div/div[2]/div[1]/a',
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;
          return botao !== null;
        }, { timeout: 40000 });
    
        console.log('Botão "Operações" encontrado. Clicando...');
    
        // Clica no botão usando XPath manualmente
        await page.evaluate(() => {
          const botao = document.evaluate(
            '/html/body/app-root/bn-container/main/app-home/div[1]/div/div[2]/div[1]/a',
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;
          if (botao) botao.click();
        });
    
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log('Botão "Operações" clicado com sucesso.');   
        
        // Espera o link com ID 'pesquisa_avancada' e clica nele
        await page.waitForSelector('#pesquisa_avancada');
        const linkPesquisa = await page.$('#pesquisa_avancada');

        if (linkPesquisa) {
        await linkPesquisa.click();
        console.log('Link "Pesquisa Avançada" clicado com sucesso.');
        } else {
        throw new Error('Link "Pesquisa Avançada" não encontrado.');
        }    
        
        // Esperar o campo de data final aparecer
        await page.waitForSelector('#dataEnvioFinal');

        // Limpar o campo de data final e disparar o evento de input
        await page.evaluate(() => {
        const campo = document.querySelector('#dataEnvioFinal');
        campo.value = '';  // Limpa o campo
        campo.dispatchEvent(new Event('input', { bubbles: true }));  // Dispara o evento de input
        });

        // Inserir a data no campo
        await page.type('#dataEnvioFinal', '08/10/2024');

        await page.waitForSelector('.btn.btn-success.botaoMenor');
        await page.click('.btn.btn-success.botaoMenor');

        // Aguardar 3 segundos para garantir que a pesquisa seja processada
        await new Promise(resolve => setTimeout(resolve, 3000));

        //Clicar no Botão Exportar Operações
        await page.evaluate(() => {
          const botoes = Array.from(document.querySelectorAll('button'));
          const botao = botoes.find(b => b.textContent.includes('Exportar operações'));
          if (botao) {
            botao.click();
            console.log('Exportação da primeira busca iniciada.');
          } else {
            throw new Error('Botão "Exportar operações" não encontrado.');
          }
        });

        await page.evaluate(() => {
          const botoes = Array.from(document.querySelectorAll('button'));
          const botao = botoes.find(b => b.textContent.includes('Exportar operações'));
          if (botao) botao.click();
        });
        await new Promise(resolve => setTimeout(resolve, 5000)); // espera 5 segundos


        //Verificar se o arquivo de fato já se encontra na pasta Downloads antes de continuar
        const downloadsPath = path.join(os.homedir(), 'Downloads');
        const nomeArquivo = 'operacoes-garantidas.csv';
        const caminhoArquivo = path.join(downloadsPath, nomeArquivo);
        const caminhoTemp = caminhoArquivo + '.crdownload';

        console.log(`Aguardando o download completo do arquivo "${nomeArquivo}"...`);

        async function esperarDownloadCompleto(arquivoFinal, arquivoTemp, timeout = 30000, intervalo = 1000) {
          const inicio = Date.now();

          return new Promise((resolve, reject) => {
            const checar = () => {
              const existeFinal = fs.existsSync(arquivoFinal);
              const existeTemp = fs.existsSync(arquivoTemp);

              if (existeFinal && !existeTemp) {
                console.log('Download concluído:', arquivoFinal);
                resolve();
              } else if (Date.now() - inicio > timeout) {
                reject(new Error('Tempo esgotado: o download não foi concluído em tempo hábil.'));
              } else {
                setTimeout(checar, intervalo);
              }
            };

            checar();
          });
        }

        await esperarDownloadCompleto(caminhoArquivo, caminhoTemp).catch(err => {
          console.error('Erro ao verificar o download:', err.message);
          throw err; // Interrompe se o download falhar
        });
        
        // Renomear o primeiro arquivo para evitar sobrescrita no segundo download
        const novoNomeArquivo1 = 'operacoes-garantidas-1.csv';
        const novoCaminhoArquivo1 = path.join(downloadsPath, novoNomeArquivo1);
        
        try {
          fs.renameSync(caminhoArquivo, novoCaminhoArquivo1);
          console.log(`Arquivo renomeado para "${novoNomeArquivo1}".`);
        } catch (err) {
          console.error('Erro ao renomear o primeiro arquivo:', err.message);
          throw err;
        }

        // Limpa o campo "Data de Envio Final"
        await page.focus('#dataEnvioFinal');
        await page.click('#dataEnvioFinal', { clickCount: 3 });
        await page.keyboard.press('Backspace');

        // Aguarda 1 segundo
        await new Promise(resolve => setTimeout(resolve, 1000));

        //Dá um Refresh na página
        console.log("Atualizando a página para a próxima busca...");
        await page.reload({ waitUntil: ['networkidle0', 'domcontentloaded'] });
        console.log("Página recarregada com sucesso.");
    
        // Aguarda 2 segundos
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Espera o link com ID 'pesquisa_avancada' e clica nele novamente
        await page.waitForSelector('#pesquisa_avancada');
        const linkPesquisa2 = await page.$('#pesquisa_avancada');

        if (linkPesquisa2) {
          await linkPesquisa2.click();
          console.log('Link "Pesquisa Avançada" clicado novamente com sucesso.');
        } else {
          throw new Error('Link "Pesquisa Avançada" não encontrado novamente.');
        } 

        // Esperar o campo de data inicial aparecer
        await page.waitForSelector('#dataEnvioInicial');

        // Limpar o campo de data inicial e disparar o evento de input
        await page.evaluate(() => {
        const campo = document.querySelector('#dataEnvioInicial');
        campo.value = '';  // Limpa o campo
        campo.dispatchEvent(new Event('input', { bubbles: true }));  // Dispara o evento de input
        });

        // Inserir a data no campo
        await page.type('#dataEnvioInicial', '09/10/2024');

        await page.waitForSelector('.btn.btn-success.botaoMenor');
        await page.click('.btn.btn-success.botaoMenor');

        // Aguardar 3 segundos para garantir que a pesquisa seja processada
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        //Clicar no Botão Exportar Operações
        await page.evaluate(() => {
          const botoes = Array.from(document.querySelectorAll('button'));
          const botao = botoes.find(b => b.textContent.includes('Exportar operações'));
          if (botao) {
            botao.click();
            console.log('Exportação da primeira busca iniciada.');
          } else {
            throw new Error('Botão "Exportar operações" não encontrado.');
          }
        });

        await page.evaluate(() => {
          const botoes = Array.from(document.querySelectorAll('button'));
          const botao = botoes.find(b => b.textContent.includes('Exportar operações'));
          if (botao) botao.click();
        });
        await new Promise(resolve => setTimeout(resolve, 5000)); // espera 5 segundos
        
// Verificar se o segundo arquivo já foi completamente baixado
console.log(`Aguardando o download completo do arquivo "${nomeArquivo}"...`);

await esperarDownloadCompleto(caminhoArquivo, caminhoTemp).catch(err => {
  console.error('Erro ao verificar o download do segundo arquivo:', err.message);
  throw err;
});

//Faz a junção dos dois arquivos baixados, renomeando e apagando ao final os arquivos baixados
const caminhoArquivo1 = path.join(downloadsPath, 'operacoes-garantidas-1.csv');
const caminhoArquivo2 = path.join(downloadsPath, 'operacoes-garantidas.csv');

try {
  // Ler os arquivos
  const dados1 = fs.readFileSync(caminhoArquivo1, 'utf-8').split('\n');
  const dados2 = fs.readFileSync(caminhoArquivo2, 'utf-8').split('\n');

  const cabecalho = dados1[0];
  const linhas1 = dados1.slice(1).filter(l => l.trim() !== '');
  const linhas2 = dados2.slice(1).filter(l => l.trim() !== '');

  const todasAsLinhas = [cabecalho, ...linhas1, ...linhas2].join('\n');

  // Gerar nome de arquivo com data
  const dataHoje = new Date();
  const dia = String(dataHoje.getDate()).padStart(2, '0');
  const mes = String(dataHoje.getMonth() + 1).padStart(2, '0');
  const ano = dataHoje.getFullYear();
  const nomeFinal = `operacoes-garantidas-${dia}-${mes}-${ano}.csv`;
  const destinoFinal = path.join('/Users/wagnernobre/FGI PEAC/', nomeFinal);

  // Salvar arquivo final
  fs.writeFileSync(destinoFinal, todasAsLinhas, 'utf-8');
  console.log(`Arquivo final salvo em: ${destinoFinal}`);

  // Apagar os arquivos da pasta Downloads
  fs.unlinkSync(caminhoArquivo1);
  fs.unlinkSync(caminhoArquivo2);
  console.log('Arquivos temporários apagados da pasta Downloads.');
} catch (erro) {
  console.error('Erro ao combinar os arquivos CSV:', erro.message);
  throw erro;
}

// ✔️ Fechar o navegador e finalizar a resposta
await browser.close();
res.send('Arquivos Baixados com Sucesso!');
} catch (err) {
  console.error('Erro na automação:', err);
  res.status(500).send('Erro na automação. Tente novamente.');
}
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});