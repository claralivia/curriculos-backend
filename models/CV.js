const mongoose = require('mongoose');

const CVSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tituloDocumento: { type: String, default: 'Novo Currículo' },
  estilizacao: {
    corPrincipal: { type: String, default: '#4f9d76' },
    fontFamily: { type: String, default: 'font-sans' },
    exibirFoto: { type: Boolean, default: true },
    exibirSubtitulo: { type: Boolean, default: true },
    tamanhoFoto: { type: String, default: 'medio' },
    formatoFoto: { type: String, default: 'circulo' },
    espacamento: { type: String, default: 'padrao' },
    modeloCabecalho: { type: String, default: 'modelo1' },
    caixaAlta: {
      nome: { type: Boolean, default: true },
      cargo: { type: Boolean, default: true },
      contatos: { type: Boolean, default: true },
      titulosSecao: { type: Boolean, default: true },
      titulosItem: { type: Boolean, default: true },
      subtitulosItem: { type: Boolean, default: true },
      textosGerais: { type: Boolean, default: false }
    }
  },
  secoes: [{
    id: String,
    titulo: String,
    tipo: { type: String, enum: ['texto', 'itens'], default: 'texto' },
    conteudo: { type: String, default: '' },
    visivel: { type: Boolean, default: true },
    itens: [{
      titulo: String,
      subtitulo: String,
      descricao: String,
      visivel: { type: Boolean, default: true }
    }]
  }],
  dados: {
    nome: String,
    subtitulo: String,
    foto: String,
    fotoPath: String,
    sobre: String,
    nacionalidade: String,
    autorizacaoTrabalho: String,
    contato: { 
      telemovel: String, 
      email: String, 
      endereco: String
    }
  }
});

module.exports = mongoose.model('CV', CVSchema);
