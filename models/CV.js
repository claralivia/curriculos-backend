const mongoose = require('mongoose');

const CVSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tituloDocumento: { type: String, default: 'Novo Currículo' },
  estilizacao: {
    corPrincipal: { type: String, default: '#4f9d76' },
    fontFamily: { type: String, default: 'font-sans' },
    exibirFoto: { type: Boolean, default: true },
    exibirSubtitulo: { type: Boolean, default: true }
  },
  secoes: [{
    id: String,
    titulo: String,
    tipo: { type: String, enum: ['texto', 'itens'], default: 'texto' },
    conteudo: { type: String, default: '' },
    itens: [{
      titulo: String,
      subtitulo: String,
      descricao: String
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