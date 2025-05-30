// Dados em memória
let receitas = [];
let despesas = [];
let investimentos = [];
let configuracaoReserva = { valorAtual: 0, gastosEssenciais: 0 };

const defaultCategoriasReceita = ["Salário", "Freelance", "Rendimentos de Investimentos", "Vendas", "Outros"];
const defaultCategoriasDespesa = ["Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Serviços", "Vestuário", "Impostos", "Outros"];
let customCategoriasReceita = []; // Será populado por carregarConfiguracoesLocais ou do backend
let customCategoriasDespesa = []; // Será populado por carregarConfiguracoesLocais ou do backend
let todasCategoriasDoUsuario = []; // Array para categorias vindas do backend {id, nome, tipo}

let editingReceitaId = null;
let editingDespesaId = null;
let editingInvestimentoId = null;

const confirmModal = document.getElementById('confirmModal');
const modalMessageText = document.getElementById('modalMessageText');
const modalConfirmButton = document.getElementById('modalConfirmButton');
const modalCancelButton = document.getElementById('modalCancelButton');
let currentModalResolve = null;

const handleModalConfirm = () => { if(confirmModal) confirmModal.style.display = 'none'; if (currentModalResolve) currentModalResolve(true); cleanupModalListeners(); };
const handleModalCancel = () => { if(confirmModal) confirmModal.style.display = 'none'; if (currentModalResolve) currentModalResolve(false); cleanupModalListeners(); };
const handleModalOutsideClick = (event) => { if (event.target === confirmModal) { if(confirmModal) confirmModal.style.display = 'none'; if (currentModalResolve) currentModalResolve(false); cleanupModalListeners(); } };
function cleanupModalListeners() { if(modalConfirmButton) modalConfirmButton.removeEventListener('click', handleModalConfirm); if(modalCancelButton) modalCancelButton.removeEventListener('click', handleModalCancel); window.removeEventListener('click', handleModalOutsideClick); currentModalResolve = null; }
function abrirModalConfirmacao(message) { return new Promise((resolve) => { cleanupModalListeners(); currentModalResolve = resolve; if(modalMessageText) modalMessageText.textContent = message; if(confirmModal) confirmModal.style.display = 'block'; if(modalConfirmButton) modalConfirmButton.addEventListener('click', handleModalConfirm); if(modalCancelButton) modalCancelButton.addEventListener('click', handleModalCancel); window.addEventListener('click', handleModalOutsideClick); });}

const userInfoDiv = document.getElementById('userInfo');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const loginRegisterFormsDiv = document.getElementById('loginRegisterForms');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
let isLoginInProgress = false;
let isRegisterInProgress = false;

if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged(async user => { 
        isLoginInProgress = false; isRegisterInProgress = false;
        const loginSubmitButton = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
        const registerSubmitButton = registerForm ? registerForm.querySelector('button[type="submit"]') : null;
        if(loginSubmitButton) loginSubmitButton.disabled = false;
        if(registerSubmitButton) registerSubmitButton.disabled = false;

        if (user) {
            console.log("onAuthStateChanged: Usuário logado:", user.email, "UID:", user.uid);
            if(userInfoDiv) userInfoDiv.style.display = 'block';
            if(userEmailDisplay) userEmailDisplay.textContent = user.email;
            if(loginRegisterFormsDiv) loginRegisterFormsDiv.style.display = 'none';
            if (typeof carregarDadosDoUsuarioLogado === "function") await carregarDadosDoUsuarioLogado();
        } else {
            console.log("onAuthStateChanged: Nenhum usuário logado.");
            if(userInfoDiv) userInfoDiv.style.display = 'none';
            if(userEmailDisplay) userEmailDisplay.textContent = '';
            if(loginRegisterFormsDiv) loginRegisterFormsDiv.style.display = 'block';
            receitas = []; despesas = []; investimentos = []; 
            configuracaoReserva = { valorAtual: 0, gastosEssenciais: 0 };
            todasCategoriasDoUsuario = []; // Limpa categorias do usuário
            if (typeof carregarConfiguracoesLocais === "function") carregarConfiguracoesLocais();
            if (typeof atualizarInterfaceCompleta === "function") atualizarInterfaceCompleta(); 
        }
    });
} else {
    console.error("Firebase Auth (variável 'auth') não foi inicializado.");
    if(loginRegisterFormsDiv) {
        loginRegisterFormsDiv.innerHTML = "<p style='color:red; text-align:center; padding:10px; background-color: rgba(255,0,0,0.1); border-radius:5px;'>Erro crítico: Falha na autenticação.</p>";
        loginRegisterFormsDiv.style.display = 'block';
    }
    if(userInfoDiv) userInfoDiv.style.display = 'none';
}

async function sincronizarUsuarioComBackend(firebaseUser) {
    if (!firebaseUser || typeof auth === 'undefined' || !auth) { mostrarNotificacao("Erro interno de autenticação.", "error"); return; }
    console.log("FRONTEND: Sincronizando usuário com backend:", firebaseUser.email);
    try {
        const idToken = await firebaseUser.getIdToken(true);
        if (!idToken) { mostrarNotificacao("Token de autenticação inválido.", "error"); return; }
        const response = await fetch('http://localhost:3001/api/users/sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }
        });
        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) { data = await response.json(); } 
        else { const responseText = await response.text(); data = { message: `Resposta do servidor (${response.status}): ${responseText || response.statusText}`}; console.warn("Resposta do servidor não era JSON:", responseText); }
        if (response.ok) console.log('FRONTEND: Usuário sincronizado com backend:', data);
        else { console.error('FRONTEND: Falha sincronizar usuário:', response.status, data); mostrarNotificacao(`${data.message || 'Erro do servidor.'}`, 'error');}
    } catch (error) { console.error('FRONTEND: Erro de rede sincronização:', error); mostrarNotificacao('Erro de comunicação ao sincronizar.', 'error'); }
}

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isRegisterInProgress) { mostrarNotificacao("Processando...", "info"); return; }
        if (typeof auth === 'undefined') { mostrarNotificacao('Autenticação indisponível.', 'error'); return; }
        isRegisterInProgress = true; const btn = e.target.querySelector('button[type="submit"]'); if(btn) btn.disabled = true;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
        if (password.length < 6) { mostrarNotificacao('Senha curta (mín. 6 caracteres).', 'warning'); isRegisterInProgress = false; if(btn) btn.disabled = false; return; }
        if (password !== passwordConfirm) { mostrarNotificacao('As senhas não coincidem.', 'warning'); isRegisterInProgress = false; if(btn) btn.disabled = false; return; }
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            mostrarNotificacao('Cadastro realizado! Você está logado.', 'success');
            if (typeof sincronizarUsuarioComBackend === "function") await sincronizarUsuarioComBackend(userCredential.user);
            registerForm.reset();
        } catch (error) { mostrarNotificacao(`Erro cadastro: ${traduzirErroFirebase(error.code)}`, 'error');
        } finally { isRegisterInProgress = false; if(btn) btn.disabled = false; }
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isLoginInProgress) { mostrarNotificacao("Processando...", "info"); return; }
        if (typeof auth === 'undefined') { mostrarNotificacao('Autenticação indisponível.', 'error'); return; }
        isLoginInProgress = true; const btn = e.target.querySelector('button[type="submit"]'); if(btn) btn.disabled = true;
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            mostrarNotificacao('Login bem-sucedido!', 'success'); 
            if (typeof sincronizarUsuarioComBackend === "function") await sincronizarUsuarioComBackend(userCredential.user);
            loginForm.reset();
        } catch (error) { mostrarNotificacao(`Erro login: ${traduzirErroFirebase(error.code)}`, 'error');
        } finally { isLoginInProgress = false; if(btn) btn.disabled = false; }
    });
}

async function handleLogout() {
    if (typeof auth === 'undefined') { mostrarNotificacao('Autenticação indisponível.', 'error'); return; }
    try { await auth.signOut(); mostrarNotificacao('Você foi desconectado.', 'info'); } 
    catch (error) { mostrarNotificacao(`Erro ao sair: ${error.message}`, 'error'); }
}

function traduzirErroFirebase(errorCode) {
    switch (errorCode) {
        case 'auth/email-already-in-use': return 'Este email já está cadastrado.';
        case 'auth/invalid-email': return 'O formato do email é inválido.';
        case 'auth/operation-not-allowed': return 'Login com email/senha não está habilitado.';
        case 'auth/weak-password': return 'A senha é muito fraca (mínimo 6 caracteres).';
        case 'auth/user-disabled': return 'Este usuário foi desabilitado.';
        case 'auth/user-not-found': return 'Usuário não encontrado.';
        case 'auth/wrong-password': return 'Senha incorreta.';
        case 'auth/missing-password': return 'Senha não informada.';
        case 'auth/invalid-credential': return 'Credenciais inválidas (email ou senha).';
        case 'auth/configuration-not-found': return 'Configuração de autenticação não encontrada. Verifique o Firebase Console.';
        default: console.warn("Código de erro Firebase não traduzido:", errorCode); return `Erro desconhecido (${errorCode})`;
    }
}

async function fetchData(endpoint, method = 'GET', body = null) {
    if (!auth.currentUser) { mostrarNotificacao("Autenticação necessária.", "error"); throw new Error("Usuário não autenticado."); }
    const idToken = await auth.currentUser.getIdToken(true);
    const options = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` } };
    if (body && method !== 'GET' && method !== 'HEAD') options.body = JSON.stringify(body);
    const response = await fetch(`http://localhost:3001/api${endpoint}`, options);
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) { data = await response.json(); } 
    else { const textResponse = await response.text(); if (!response.ok) throw new Error(textResponse || `Erro ${response.status} ao acessar ${endpoint}. Resposta não JSON.`); data = { message: textResponse }; }
    if (!response.ok) throw new Error(data.message || `Erro ${response.status} ao ${method} ${endpoint}`);
    return data;
}

async function carregarDadosDoUsuarioLogado() {
    if (!auth.currentUser) {
        console.log("Nenhum usuário logado para carregar dados do backend.");
        receitas = []; despesas = []; investimentos = []; todasCategoriasDoUsuario = [];
        carregarConfiguracoesLocais(); 
        if (typeof atualizarInterfaceCompleta === "function") atualizarInterfaceCompleta();
        return;
    }
    console.log("FRONTEND: Iniciando carregamento de todos os dados do usuário do backend...");
    try {
        const [dadosReceitas, dadosDespesas, dadosInvestimentos, dadosCategorias] = await Promise.all([
            fetchData('/receitas').catch(e => { console.error("Fetch Receitas falhou:", e); return []; }),
            fetchData('/despesas').catch(e => { console.error("Fetch Despesas falhou:", e); return []; }),
            fetchData('/investimentos').catch(e => { console.error("Fetch Investimentos falhou:", e); return []; }),
            fetchData('/categorias').catch(e => { console.error("Fetch Categorias falhou:", e); return []; })
        ]);

        receitas = Array.isArray(dadosReceitas) ? dadosReceitas : [];
        despesas = Array.isArray(dadosDespesas) ? dadosDespesas : [];
        investimentos = Array.isArray(dadosInvestimentos) ? dadosInvestimentos : [];
        todasCategoriasDoUsuario = Array.isArray(dadosCategorias) ? dadosCategorias : [];
        
        console.log(`Dados carregados: ${receitas.length}R, ${despesas.length}D, ${investimentos.length}I, ${todasCategoriasDoUsuario.length}C`);
        carregarConfiguracoesLocais(); // Carrega configs locais e ATUALIZA dropdowns e lista de categorias
        mostrarNotificacao("Dados carregados do servidor!", "success");
    } catch (error) {
        console.error("Erro GERAL ao carregar dados do usuário do backend:", error);
        mostrarNotificacao(`Erro ao carregar dados: ${error.message || 'Verifique o console do backend.'}`, "error");
        receitas = []; despesas = []; investimentos = []; todasCategoriasDoUsuario = [];
        carregarConfiguracoesLocais(); 
    } finally {
        if (typeof atualizarInterfaceCompleta === "function") atualizarInterfaceCompleta();
    }
}

function carregarConfiguracoesLocais() {
    console.log("Executando carregarConfiguracoesLocais...");
    try {
        const dadosString = localStorage.getItem('dadosFinanceirosApp_configGlobal');
        if (dadosString) {
            const dadosApp = JSON.parse(dadosString);
            configuracaoReserva = dadosApp.configuracaoReserva || { valorAtual: 0, gastosEssenciais: 0 };
            // Categorias customizadas são agora primariamente gerenciadas por 'todasCategoriasDoUsuario' vindo do backend.
            // As custom locais do localStorage só seriam usadas se o backend não retornasse nada,
            // mas a lógica atual de popularDropdown já combina defaults com o que vier de todasCategoriasDoUsuario.
            // Podemos manter customCategoriasReceita/Despesa para a lógica da aba de configurações se ela ainda for local.
            customCategoriasReceita = Array.isArray(dadosApp.customCategoriasReceita) ? dadosApp.customCategoriasReceita : [];
            customCategoriasDespesa = Array.isArray(dadosApp.customCategoriasDespesa) ? dadosApp.customCategoriasDespesa : [];
        } else {
            configuracaoReserva = { valorAtual: 0, gastosEssenciais: 0 };
            customCategoriasReceita = []; 
            customCategoriasDespesa = [];
        }
    } catch(e) {
        console.error("Erro ao carregar configs do localStorage:", e);
        configuracaoReserva = { valorAtual: 0, gastosEssenciais: 0 }; 
        customCategoriasReceita = []; 
        customCategoriasDespesa = [];
    }
    // Estas funções agora usam 'todasCategoriasDoUsuario' (que inclui defaults se backend vazio)
    // e 'customCategoriasReceita/Despesa' (que são as custom do usuário gerenciadas pela UI de config)
    if (typeof popularTodosOsDropdownsDeCategoria === "function") popularTodosOsDropdownsDeCategoria();
    if (typeof renderizarListasDeCategoriasGerenciador === "function") renderizarListasDeCategoriasGerenciador();
}

function salvarDadosConfigLocal(manual = false) { 
    try {
        const dadosApp = { configuracaoReserva, customCategoriasReceita, customCategoriasDespesa, dataUltimoSave: new Date().toISOString() };
        localStorage.setItem('dadosFinanceirosApp_configGlobal', JSON.stringify(dadosApp));
        if(manual) mostrarNotificacao('Configurações locais salvas!', 'success');
    } catch (e) { console.error("Erro ao salvar configs locais:", e); mostrarNotificacao('Erro configs locais: ' + e.message, 'error');}
}

function atualizarInterfaceCompleta() {
    if (typeof atualizarDashboard === "function") atualizarDashboard();
    if (typeof atualizarAnaliseReserva === "function") atualizarAnaliseReserva();
    if (typeof atualizarEstatisticasDados === "function") atualizarEstatisticasDados();
    const elValorReservaAtual = document.getElementById('valorReservaAtual');
    const elGastosEssenciais = document.getElementById('gastosEssenciais');
    if (elValorReservaAtual && configuracaoReserva) elValorReservaAtual.value = configuracaoReserva.valorAtual || 0;
    if (elGastosEssenciais && configuracaoReserva) elGastosEssenciais.value = configuracaoReserva.gastosEssenciais || 0;
    
    const activeTabContent = document.querySelector('.tab-content.active');
    if (activeTabContent) {
        const activeTabId = activeTabContent.id;
        if (activeTabId === 'receitas' && typeof atualizarListaReceitas === "function") atualizarListaReceitas();
        else if (activeTabId === 'despesas' && typeof atualizarListaDespesas === "function") atualizarListaDespesas();
        else if (activeTabId === 'investimentos' && typeof atualizarListaInvestimentos === "function") atualizarListaInvestimentos();
        else if (activeTabId === 'configuracoes' && typeof renderizarListasDeCategoriasGerenciador === "function") renderizarListasDeCategoriasGerenciador();
    } else { 
        if (typeof atualizarListaReceitas === "function") atualizarListaReceitas();
        if (typeof atualizarListaDespesas === "function") atualizarListaDespesas();
        if (typeof atualizarListaInvestimentos === "function") atualizarListaInvestimentos();
    }
}
    
// --- GERENCIAMENTO DE CATEGORIAS ---
function popularDropdown(selectId, categoriasDisponiveis, valorAtualId = null) { 
    // categoriasDisponiveis é AGORA um array de objetos {id, nome, tipo}
    const selectElement = document.getElementById(selectId); 
    if(!selectElement) { console.warn(`Dropdown ${selectId} não encontrado.`); return; } 
    
    let valorAnterior = selectElement.value; // Salva o ID selecionado anteriormente
    selectElement.innerHTML = '<option value="">Selecione...</option>'; 
    
    (categoriasDisponiveis || []).forEach(catObj => { 
        const option = document.createElement('option'); 
        option.value = catObj.id; // USA O ID DA CATEGORIA COMO VALOR
        option.textContent = catObj.nome; 
        selectElement.appendChild(option); 
    }); 
    
    if (valorAtualId !== null && valorAtualId !== undefined && String(valorAtualId) !== "") {
        if (Array.from(selectElement.options).some(opt => String(opt.value) === String(valorAtualId))) {
            selectElement.value = String(valorAtualId);
        } else {
             console.warn(`ID de categoria "${valorAtualId}" não encontrado no dropdown ${selectId} ao tentar pré-selecionar. Categoria pode ter sido removida ou não pertence a este tipo.`);
             selectElement.value = ""; 
        }
    } else if (valorAnterior && Array.from(selectElement.options).some(opt => opt.value === valorAnterior)) {
        selectElement.value = valorAnterior; 
    } else {
        selectElement.value = ""; 
    }
}

function popularTodosOsDropdownsDeCategoria(categoriaIdSelecionadaReceita = null, categoriaIdSelecionadaDespesa = null) { 
    // todasCategoriasDoUsuario é preenchido por carregarDadosDoUsuarioLogado -> fetchData('/categorias')
    // e deve conter objetos {id, nome, tipo, usuarioFirebaseUid}
    const catsReceitaParaDropdown = todasCategoriasDoUsuario.filter(c => c.tipo === 'receita');
    const catsDespesaParaDropdown = todasCategoriasDoUsuario.filter(c => c.tipo === 'despesa');
    
    popularDropdown('categoriaReceita', catsReceitaParaDropdown, categoriaIdSelecionadaReceita); 
    popularDropdown('categoriaDespesa', catsDespesaParaDropdown, categoriaIdSelecionadaDespesa); 
}

function renderizarListaCategorias(tipo) { 
    const listaUlId = tipo === 'receita' ? 'listaCategoriasReceita' : 'listaCategoriasDespesa'; 
    // Filtra apenas as categorias customizadas DO USUÁRIO LOGADO para gerenciamento
    const categoriasParaGerenciar = todasCategoriasDoUsuario.filter(cat => cat.tipo === tipo && cat.usuarioFirebaseUid !== null);
    const ulElement = document.getElementById(listaUlId); 
    if(!ulElement) return; 
    ulElement.innerHTML = ''; 
    (categoriasParaGerenciar || []).forEach(cat => { 
        const li = document.createElement('li'); 
        li.textContent = cat.nome; 
        const btnRemover = document.createElement('button'); 
        btnRemover.innerHTML = '<i class="fas fa-trash-alt"></i>'; 
        btnRemover.className = 'btn btn-danger'; 
        btnRemover.style.padding = '3px 8px'; btnRemover.style.fontSize = '12px'; btnRemover.style.marginLeft = '10px'; 
        btnRemover.onclick = () => removerCategoria(cat.id); // Passa o ID da categoria
        li.appendChild(btnRemover); 
        ulElement.appendChild(li); 
    }); 
}
function renderizarListasDeCategoriasGerenciador(){ renderizarListaCategorias('receita'); renderizarListaCategorias('despesa'); }

async function adicionarNovaCategoria(tipo) { 
    const inputId = tipo === 'receita' ? 'inputNovaCategoriaReceita' : 'inputNovaCategoriaDespesa'; 
    const inputElement = document.getElementById(inputId); 
    if(!inputElement) return; 
    const nomeCategoria = inputElement.value.trim(); 
    if (!nomeCategoria) { mostrarNotificacao('Nome da categoria não pode ser vazio.', 'warning'); return; } 

    // Verifica no frontend se já existe uma categoria com mesmo nome e tipo (do usuário ou global)
    if (todasCategoriasDoUsuario.some(cat => cat.nome.toLowerCase() === nomeCategoria.toLowerCase() && cat.tipo === tipo)) {
        mostrarNotificacao('Uma categoria com este nome e tipo já existe.', 'info');
        return;
    }
    // Também poderia verificar contra as defaultCategorias... se elas não estiverem incluídas em todasCategoriasDoUsuario como globais
    // const defaultsDoTipo = tipo === 'receita' ? defaultCategoriasReceita : defaultCategoriasDespesa;
    // if (defaultsDoTipo.some(defCat => defCat.toLowerCase() === nomeCategoria.toLowerCase())) {
    //     mostrarNotificacao('Uma categoria padrão com este nome já existe.', 'info'); return;
    // }

    try {
        const novaCategoriaDoServidor = await fetchData('/categorias', 'POST', { nome: nomeCategoria, tipo });
        mostrarNotificacao(`Categoria "${novaCategoriaDoServidor.nome}" adicionada com sucesso!`, 'success');
        inputElement.value = '';
        await carregarDadosDoUsuarioLogado(); // Recarrega tudo, incluindo categorias, e atualiza UI
    } catch (error) {
        mostrarNotificacao(error.message || 'Erro ao adicionar categoria.', 'error');
    }
}

async function removerCategoria(categoriaId) { 
    const categoria = todasCategoriasDoUsuario.find(c => c.id === categoriaId);
    if (!categoria) { mostrarNotificacao("Categoria não encontrada para remoção.", "error"); return; }
    if (categoria.usuarioFirebaseUid === null) { mostrarNotificacao("Categorias padrão/globais não podem ser removidas.", "warning"); return; }

    const confirmado = await abrirModalConfirmacao(`Remover sua categoria "${categoria.nome}"?`); 
    if (confirmado) { 
        try { 
            await fetchData(`/categorias/${categoriaId}`, 'DELETE'); 
            mostrarNotificacao(`Categoria "${categoria.nome}" removida com sucesso!`, 'info'); 
            await carregarDadosDoUsuarioLogado(); 
        } catch (error) { mostrarNotificacao(error.message || 'Erro ao remover categoria.', 'error'); }
    } else { mostrarNotificacao('Remoção de categoria cancelada.', 'info');} 
}

// --- EXPORT/IMPORT E DADOS ---
// ... (Suas funções de exportar/importar como estavam na última versão completa) ...
function exportarDados() { try { const dadosApp = { receitas, despesas, investimentos, configuracaoReserva, customCategoriasReceita, customCategoriasDespesa, dataExportacao: new Date().toISOString(), versaoApp: 'CFP_1.2_backend_full' }; const dadosJSON = JSON.stringify(dadosApp, null, 2); const blob = new Blob([dadosJSON], { type: 'application/json' }); const url = URL.createObjectURL(blob); const agora = new Date(); const nomeArquivo = `controle_financeiro_pessoal_backup_${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}.json`; const link = document.createElement('a'); link.href = url; link.download = nomeArquivo; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); mostrarNotificacao(`Backup exportado: ${nomeArquivo}`, 'success'); } catch (error) { console.error('Erro ao exportar:', error); mostrarNotificacao('Erro ao exportar dados: ' + error.message, 'error'); } }
async function processarImportacao(dadosTexto) { const confirmado = await abrirModalConfirmacao("Importar estes dados? Dados LOCAIS (configurações, categorias customizadas) serão sobrescritos. Dados de transações serão carregados em memória e precisarão ser salvos no servidor um a um (ou aguarde uma função de 'sincronizar tudo')."); if (!confirmado) { mostrarNotificacao("Importação cancelada.", "info"); return; } try { const dadosApp = JSON.parse(dadosTexto); if (typeof dadosApp !== 'object' || dadosApp === null || !dadosApp.versaoApp || !dadosApp.versaoApp.startsWith('CFP_')) { throw new Error('Formato de dados inválido ou arquivo não compatível.'); } receitas = Array.isArray(dadosApp.receitas) ? dadosApp.receitas : []; despesas = Array.isArray(dadosApp.despesas) ? dadosApp.despesas : []; investimentos = Array.isArray(dadosApp.investimentos) ? dadosApp.investimentos : []; configuracaoReserva = typeof dadosApp.configuracaoReserva === 'object' && dadosApp.configuracaoReserva !== null ? dadosApp.configuracaoReserva : { valorAtual: 0, gastosEssenciais: 0 }; customCategoriasReceita = Array.isArray(dadosApp.customCategoriasReceita) ? dadosApp.customCategoriasReceita : []; customCategoriasDespesa = Array.isArray(dadosApp.customCategoriasDespesa) ? dadosApp.customCategoriasDespesa : []; salvarDadosConfigLocal(); popularTodosOsDropdownsDeCategoria(); renderizarListasDeCategoriasGerenciador(); atualizarInterfaceCompleta(); mostrarNotificacao(`Dados do arquivo carregados em memória. Salve transações individualmente para persistir no servidor.`, 'success'); } catch (e) { console.error("Erro ao importar:", e); mostrarNotificacao('Erro ao importar: ' + e.message, 'error'); } }
function importarDados(event) { const inputArquivo = event.target; if (!inputArquivo || !inputArquivo.files || !inputArquivo.files.length === 0) { mostrarNotificacao('Nenhum arquivo selecionado.', 'warning'); return; } const arquivo = inputArquivo.files[0]; if (arquivo.type !== "application/json") { mostrarNotificacao('Tipo de arquivo inválido (.json).', 'warning'); inputArquivo.value = null; return; } const reader = new FileReader(); reader.onload = async (e) => { try { await processarImportacao(e.target.result); } catch (error) { mostrarNotificacao('Erro ao ler arquivo: ' + error.message, 'error'); } }; reader.readAsText(arquivo); inputArquivo.value = null; }
function copiarDadosAreaTransferencia() { try { const dadosApp = { receitas, despesas, investimentos, configuracaoReserva, customCategoriasReceita, customCategoriasDespesa, dataExportacao: new Date().toISOString(), versaoApp: 'CFP_1.2_backend_full' }; const dadosJSON = JSON.stringify(dadosApp, null, 2); if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(dadosJSON).then(() => mostrarNotificacao('Dados copiados!', 'success')).catch(() => copiarTextoFallback(dadosJSON)); } else { copiarTextoFallback(dadosJSON); } } catch (error) { mostrarNotificacao('Erro ao copiar: ' + error.message, 'error'); } }
function copiarTextoFallback(texto) { try { const ta = document.createElement('textarea'); ta.value = texto; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, 99999); document.execCommand('copy'); document.body.removeChild(ta); mostrarNotificacao('Dados copiados (fallback)!', 'success'); } catch (e) { mostrarNotificacao('Cópia falhou. Dados no console.', 'info'); console.log("Dados para cópia:\n",texto); } }
function mostrarAreaImportacao() { const area = document.getElementById('areaImportacaoTexto'); if(area) { area.style.display = 'block'; const textarea = document.getElementById('textoImportacao'); if(textarea) textarea.focus(); } }
function ocultarAreaImportacao() { const area = document.getElementById('areaImportacaoTexto'); if(area) { area.style.display = 'none'; const textarea = document.getElementById('textoImportacao'); if(textarea) textarea.value = ''; } }
async function importarViaTexto() { const textarea = document.getElementById('textoImportacao'); if(!textarea) return; const texto = textarea.value.trim(); if (!texto) { mostrarNotificacao('Cole os dados JSON.', 'warning'); return; } try { await processarImportacao(texto); ocultarAreaImportacao(); } catch (error) { mostrarNotificacao('Erro ao processar JSON: ' + error.message, 'error');} }
async function limparTodosDados() { const c1 = await abrirModalConfirmacao('⚠️ Limpar configurações locais (Reserva, Categorias Customizadas)? NÃO afetará dados no servidor.'); if (c1) { const c2 = await abrirModalConfirmacao('🚨 ÚLTIMA CONFIRMAÇÃO: Configurações LOCAIS serão PERDIDAS. Continuar?'); if (c2) { try { configuracaoReserva = { valorAtual: 0, gastosEssenciais: 0 }; customCategoriasReceita = [...defaultCategoriasReceita]; customCategoriasDespesa = [...defaultCategoriasDespesa]; localStorage.removeItem('dadosFinanceirosApp_configGlobal'); popularTodosOsDropdownsDeCategoria(); renderizarListasDeCategoriasGerenciador(); atualizarInterfaceCompleta(); mostrarNotificacao('Configurações locais resetadas para o padrão.', 'info'); } catch (error) { mostrarNotificacao('Erro ao limpar configs locais.', 'error'); } } else { mostrarNotificacao('Limpeza cancelada.', 'info'); } } else { mostrarNotificacao('Limpeza cancelada.', 'info'); } }
function atualizarEstatisticasDados() { const elTR = document.getElementById('totalReceitasCadastradas'); const elTD = document.getElementById('totalDespesasCadastradas'); const elTI = document.getElementById('totalInvestimentosCadastrados'); const elPR = document.getElementById('primeiroRegistro'); if(elTR) elTR.textContent = receitas.length; if(elTD) elTD.textContent = despesas.length; if(elTI) elTI.textContent = investimentos.length; const todasDatas = [...receitas.map(r => r.data), ...despesas.map(d => d.data), ...investimentos.map(i => i.data)].filter(d => d); if (todasDatas.length > 0) { todasDatas.sort((a, b) => new Date(a) - new Date(b)); if(elPR) elPR.textContent = formatarData(todasDatas[0]); } else { if(elPR) elPR.textContent = '-'; } }

// --- NOTIFICAÇÕES ---
function mostrarNotificacao(mensagem, tipo = 'success') { const el = document.querySelector('.app-notificacao'); if (el) el.remove(); const n = document.createElement('div'); n.className = 'app-notificacao'; n.style.cssText = `position:fixed; top:20px; right:20px; padding:15px 25px; border-radius:8px; color:white; font-weight:500; z-index:10001; box-shadow:0 4px 15px rgba(0,0,0,0.25); transform:translateX(120%); transition:transform 0.4s ease-out;`; switch(tipo) { case 'success': n.style.backgroundColor = '#28a745'; break; case 'error': n.style.backgroundColor = '#dc3545'; break; case 'info': n.style.backgroundColor = '#17a2b8'; break; case 'warning': n.style.backgroundColor = '#ffc107'; n.style.color = '#212529'; break; default: n.style.backgroundColor = '#6c757d'; } n.textContent = mensagem; document.body.appendChild(n); setTimeout(() => { n.style.transform = 'translateX(0)'; }, 50); setTimeout(() => { n.style.transform = 'translateX(120%)'; setTimeout(() => { if (n.parentNode) n.remove(); }, 400); }, 3500); }

// --- NAVEGAÇÃO POR ABAS ---
function openTab(event, tabName) { document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active')); document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); const tc = document.getElementById(tabName); if(tc) tc.classList.add('active'); const tb = event ? event.currentTarget : document.querySelector(`.tab[onclick*="'${tabName}'"]`); if(tb && tb.classList.contains('tab')) tb.classList.add('active'); if (tabName === 'receitas' && typeof atualizarListaReceitas === "function") atualizarListaReceitas(); if (tabName === 'despesas' && typeof atualizarListaDespesas === "function") atualizarListaDespesas(); if (tabName === 'investimentos' && typeof atualizarListaInvestimentos === "function") atualizarListaInvestimentos(); if (tabName === 'configuracoes' && typeof renderizarListasDeCategoriasGerenciador === "function") renderizarListasDeCategoriasGerenciador(); if (tabName === 'reserva' && typeof atualizarAnaliseReserva === "function") atualizarAnaliseReserva(); if (tabName === 'dashboard' && typeof atualizarDashboard === "function") atualizarDashboard(); if (tabName === 'dados' && typeof atualizarEstatisticasDados === "function") atualizarEstatisticasDados(); }

// --- FORMATAÇÃO ---
function formatarMoeda(valor) { const num = Number(valor); return isNaN(num) ? "R$ 0,00" : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarData(data) { try { if(!data) return '-'; const dO = new Date(data + 'T00:00:00'); return isNaN(dO.getTime()) ? 'Data Inválida' : dO.toLocaleDateString('pt-BR', {timeZone: 'UTC'}); } catch(e) { return "Data Errada"; } }

// --- LÓGICA DE EDIÇÃO E CANCELAMENTO ---
function cancelarEdicao(tipo) { let fId, dId, tId, btnSId, btnCId, defTit, defBtnTxt; switch(tipo){ case 'receita': [fId,dId,tId,btnSId,btnCId,defTit,defBtnTxt] = ['formReceita','dataReceita','formReceitaTitulo','btnSubmitReceita','btnCancelarEdicaoReceita','💰 Adicionar Receita','Adicionar Receita']; editingReceitaId=null; break; case 'despesa': [fId,dId,tId,btnSId,btnCId,defTit,defBtnTxt] = ['formDespesa','dataDespesa','formDespesaTitulo','btnSubmitDespesa','btnCancelarEdicaoDespesa','💸 Adicionar Despesa','Adicionar Despesa']; editingDespesaId=null; break; case 'investimento': [fId,dId,tId,btnSId,btnCId,defTit,defBtnTxt] = ['formInvestimento','dataInvestimento','formInvestimentoTitulo','btnSubmitInvestimento','btnCancelarEdicaoInvestimento','📈 Adicionar Investimento','Adicionar Investimento']; editingInvestimentoId=null; break; default: console.error("Tipo inválido para cancelarEdicao:", tipo); return; } const frm=document.getElementById(fId); if(frm) frm.reset(); const elD=document.getElementById(dId); if(elD) elD.value=new Date().toISOString().split('T')[0]; const elT=document.getElementById(tId); if(elT) elT.textContent=defTit; const elBS=document.getElementById(btnSId); if(elBS) elBS.innerHTML=`<i class="fas fa-plus"></i> ${defBtnTxt.split(' ')[1] || defBtnTxt}`; const elBC=document.getElementById(btnCancelarId); if(elBC) elBC.style.display='none'; popularTodosOsDropdownsDeCategoria(); }

// --- INICIALIZAÇÃO DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', function() {
    const hoje = new Date().toISOString().split('T')[0];
    ['dataReceita', 'dataDespesa', 'dataInvestimento'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = hoje;
    });
    const switchToRegisterLink = document.getElementById('switchToRegister');
    const switchToLoginLink = document.getElementById('switchToLogin');
    const loginFormEl = document.getElementById('loginForm'); 
    const registerFormEl = document.getElementById('registerForm');
    const authTitleEl = document.getElementById('authTitle'); 
    const loginRegisterFormsContainer = document.getElementById('loginRegisterForms');

    if (switchToRegisterLink && switchToLoginLink && loginFormEl && registerFormEl) {
        switchToRegisterLink.addEventListener('click', (e) => { e.preventDefault(); loginFormEl.style.display = 'none'; registerFormEl.style.display = 'block'; if (authTitleEl) authTitleEl.textContent = 'Crie sua Nova Conta'; });
        switchToLoginLink.addEventListener('click', (e) => { e.preventDefault(); registerFormEl.style.display = 'none'; loginFormEl.style.display = 'block'; if (authTitleEl) authTitleEl.textContent = 'Acesse sua Conta ou Cadastre-se'; });
        if (loginRegisterFormsContainer && (loginRegisterFormsContainer.style.display === 'block' || getComputedStyle(loginRegisterFormsContainer).display === 'block')) {
             if (typeof auth === 'undefined' || !auth.currentUser) { loginFormEl.style.display = 'block'; registerFormEl.style.display = 'none'; if (authTitleEl) authTitleEl.textContent = 'Acesse sua Conta ou Cadastre-se'; }
        }
    } else { console.warn("Elementos para alternância de login/cadastro não encontrados."); }
    
    // carregarConfiguracoesLocais(); // Carrega defaults e o que estiver no localStorage para categorias e reserva
    console.log("DOMContentLoaded: Configurações aplicadas.");
    if (typeof openTab === "function") openTab(null, 'dashboard'); 
    else console.error("Função openTab não definida.");
    // O onAuthStateChanged cuidará do carregamento de dados do usuário ou limpeza da UI.
});