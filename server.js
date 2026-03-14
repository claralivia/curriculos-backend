require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const CV = require('./models/CV');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cors());

mongoose.connect(process.env.DATABASE_URI);

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).send('Acesso negado');
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(400).send('Token inválido');
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send('Negado');
  }

  next();
};

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).send('Credenciais inválidas ou conta inativa');
    }

    if (user.status === 'inativo') {
      return res.status(401).send('Credenciais inválidas ou conta inativa');
    }

    const senhaValida = await bcrypt.compare(password, user.password);

    if (!senhaValida) {
      return res.status(401).send('Credenciais inválidas ou conta inativa');
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET
    );

    res.json({
      token,
      nome: user.nome,
      role: user.role
    });
  } catch {
    res.status(500).send('Erro no servidor');
  }
});

app.get('/my-cvs', auth, async (req, res) => {
  try {
    const cvs = await CV.find({ userId: req.user.id });
    res.json(cvs);
  } catch {
    res.status(500).send('Erro ao buscar currículos');
  }
});

app.get('/cv/:id', auth, async (req, res) => {
  try {
    const cv = await CV.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!cv) {
      return res.status(404).send('Currículo não encontrado');
    }

    res.json(cv);
  } catch {
    res.status(500).send('Erro ao buscar currículo');
  }
});

app.post('/cv/new', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const count = await CV.countDocuments({ userId: req.user.id });

    if (user.plano.limiteTemplates !== -1 && count >= user.plano.limiteTemplates) {
      return res.status(403).send('Limite de templates atingido para seu plano.');
    }

    const novo = await CV.create({
      userId: req.user.id,
      tituloDocumento: req.body.tituloDocumento || 'Novo Currículo'
    });

    res.json(novo);
  } catch {
    res.status(500).send('Erro ao criar currículo');
  }
});

app.put('/cv/:id', auth, async (req, res) => {
  try {
    const updated = await CV.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );

    res.json(updated);
  } catch {
    res.status(500).send('Erro ao atualizar currículo');
  }
});

app.delete('/cv/:id', auth, async (req, res) => {
  try {
    await CV.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    res.send('Excluído');
  } catch {
    res.status(500).send('Erro ao excluir currículo');
  }
});

app.get('/admin/users', auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ nome: 1 });
    res.json(users);
  } catch {
    res.status(500).send('Erro ao buscar usuários');
  }
});

app.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).send('Usuário não encontrado');
    }

    res.json(user);
  } catch (error) {
    res.status(500).send('Erro ao buscar usuário');
  }
});

app.post('/admin/users/new', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).send('Negado');
    }

    const {
      nome,
      email,
      password,
      role = 'user',
      status = 'ativo',
      plano = {}
    } = req.body;

    const tipoPlano = ['lite', 'pro', 'vitalicio'].includes(plano.tipo)
      ? plano.tipo
      : 'lite';

    const limiteTemplates =
      tipoPlano === 'vitalicio' ? -1 : tipoPlano === 'pro' ? 5 : 1;

    const premium = tipoPlano === 'vitalicio' ? true : Boolean(plano.premium);

    const novoUsuario = await User.create({
      nome,
      email,
      password,
      role,
      status,
      plano: {
        tipo: tipoPlano,
        limiteTemplates,
        premium
      }
    });

    res.json({
      _id: novoUsuario._id,
      nome: novoUsuario.nome,
      email: novoUsuario.email
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).send('E-mail já cadastrado');
    }

    res.status(500).send('Erro ao criar usuário');
  }
});

app.patch('/admin/users/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).send('Negado');
    }

    const updates = {};

    if (req.body.status && ['ativo', 'inativo'].includes(req.body.status)) {
      updates.status = req.body.status;
    }

    if (req.body.role && ['user', 'admin'].includes(req.body.role)) {
      updates.role = req.body.role;
    }

    if (req.body.plano) {
      const tipoPlano = ['lite', 'pro', 'vitalicio'].includes(req.body.plano.tipo)
        ? req.body.plano.tipo
        : 'lite';

      updates.plano = {
        tipo: tipoPlano,
        limiteTemplates:
          tipoPlano === 'vitalicio' ? -1 : tipoPlano === 'pro' ? 5 : 1,
        premium: tipoPlano === 'vitalicio' ? true : Boolean(req.body.plano.premium)
      };
    }

    const updated = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true
    }).select('-password');

    res.json(updated);
  } catch {
    res.status(500).send('Erro ao atualizar usuário');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});