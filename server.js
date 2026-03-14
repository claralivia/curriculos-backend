require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const CV = require('./models/CV');
const ActivityLog = require('./models/ActivityLog');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cors());

mongoose.connect(process.env.DATABASE_URI);

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.use(cors({
  origin: process.env.FRONTEND_URL || '*' 
}));

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

const getRequestIP = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || '';
};

const registrarAtividade = async ({
  req,
  actor = null,
  action,
  resourceType = 'system',
  resourceId = '',
  metadata = {}
}) => {
  try {
    await ActivityLog.create({
      actorId: actor?._id || null,
      actorNome: actor?.nome || '',
      actorEmail: actor?.email || '',
      actorRole: actor?.role || '',
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : '',
      metadata,
      ip: getRequestIP(req),
      userAgent: req.headers['user-agent'] || ''
    });
  } catch (error) {
    console.error('Falha ao registrar atividade:', error?.message || error);
  }
};

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      await registrarAtividade({
        req,
        action: 'LOGIN_FALHO',
        resourceType: 'auth',
        metadata: {
          email,
          motivo: 'usuario_nao_encontrado'
        }
      });
      return res.status(401).send('Credenciais inválidas ou conta inativa');
    }

    if (user.status === 'inativo') {
      await registrarAtividade({
        req,
        actor: user,
        action: 'LOGIN_FALHO',
        resourceType: 'auth',
        resourceId: user._id,
        metadata: {
          email,
          motivo: 'usuario_inativo'
        }
      });
      return res.status(401).send('Credenciais inválidas ou conta inativa');
    }

    const senhaValida = await bcrypt.compare(password, user.password);

    if (!senhaValida) {
      await registrarAtividade({
        req,
        actor: user,
        action: 'LOGIN_FALHO',
        resourceType: 'auth',
        resourceId: user._id,
        metadata: {
          email,
          motivo: 'senha_invalida'
        }
      });
      return res.status(401).send('Credenciais inválidas ou conta inativa');
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET
    );

    await registrarAtividade({
      req,
      actor: user,
      action: 'LOGIN_SUCESSO',
      resourceType: 'auth',
      resourceId: user._id,
      metadata: {
        status: 'sucesso'
      }
    });

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

    await registrarAtividade({
      req,
      actor: user,
      action: 'CV_CRIADO',
      resourceType: 'cv',
      resourceId: novo._id,
      metadata: {
        tituloDocumento: novo.tituloDocumento
      }
    });

    res.json(novo);
  } catch {
    res.status(500).send('Erro ao criar currículo');
  }
});

app.put('/cv/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const updated = await CV.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.status(404).send('Currículo não encontrado');
    }

    await registrarAtividade({
      req,
      actor: user,
      action: 'CV_EDITADO',
      resourceType: 'cv',
      resourceId: updated._id,
      metadata: {
        tituloDocumento: updated.tituloDocumento,
        secoes: Array.isArray(updated.secoes) ? updated.secoes.length : 0
      }
    });

    res.json(updated);
  } catch {
    res.status(500).send('Erro ao atualizar currículo');
  }
});

app.delete('/cv/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const removido = await CV.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!removido) {
      return res.status(404).send('Currículo não encontrado');
    }

    await registrarAtividade({
      req,
      actor: user,
      action: 'CV_EXCLUIDO',
      resourceType: 'cv',
      resourceId: removido._id,
      metadata: {
        tituloDocumento: removido.tituloDocumento
      }
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

    const admin = await User.findById(req.user.id);
    await registrarAtividade({
      req,
      actor: admin,
      action: 'ADMIN_USUARIO_CRIADO',
      resourceType: 'user',
      resourceId: novoUsuario._id,
      metadata: {
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        role: novoUsuario.role,
        status: novoUsuario.status,
        plano: novoUsuario.plano?.tipo || 'lite'
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

    if (!updated) {
      return res.status(404).send('Usuário não encontrado');
    }

    const admin = await User.findById(req.user.id);
    await registrarAtividade({
      req,
      actor: admin,
      action: 'ADMIN_USUARIO_ATUALIZADO',
      resourceType: 'user',
      resourceId: updated._id,
      metadata: {
        nome: updated.nome,
        email: updated.email,
        role: updated.role,
        status: updated.status,
        plano: updated.plano?.tipo || 'lite',
        premium: Boolean(updated.plano?.premium)
      }
    });

    res.json(updated);
  } catch {
    res.status(500).send('Erro ao atualizar usuário');
  }
});

app.get('/admin/activity-logs', auth, isAdmin, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 500)) : 100;

    const logs = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(logs);
  } catch {
    res.status(500).send('Erro ao buscar logs de atividade');
  }
});

app.get('/admin/backups/cvs', auth, isAdmin, async (req, res) => {
  try {
    const filtro = {};
    if (req.query.userId) {
      filtro.userId = req.query.userId;
    }

    const cvs = await CV.find(filtro).sort({ updatedAt: -1 }).lean();
    const userIds = [...new Set(cvs.map((cv) => String(cv.userId)).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } })
      .select('nome email status plano')
      .lean();

    const usersMap = users.reduce((acc, user) => {
      acc[String(user._id)] = user;
      return acc;
    }, {});

    const payload = {
      generatedAt: new Date().toISOString(),
      totalCVs: cvs.length,
      totalUsers: users.length,
      cvs: cvs.map((cv) => ({
        ...cv,
        owner: usersMap[String(cv.userId)] || null
      }))
    };

    const dataTag = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="backup-cvs-${dataTag}.json"`);

    const admin = await User.findById(req.user.id);
    await registrarAtividade({
      req,
      actor: admin,
      action: 'ADMIN_BACKUP_CVS_GERADO',
      resourceType: 'backup',
      metadata: {
        totalCVs: cvs.length,
        totalUsers: users.length,
        filtroUserId: req.query.userId || null
      }
    });

    res.status(200).send(JSON.stringify(payload, null, 2));
  } catch {
    res.status(500).send('Erro ao gerar backup dos currículos');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});