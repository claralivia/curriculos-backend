router.post('/cv/new', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const count = await CV.countDocuments({ userId: req.user.id });

    // Bloqueio de monetização
    if (count >= user.plano.limiteTemplates) {
      return res.status(403).json({ 
        message: `Limite de ${user.plano.limiteTemplates} templates atingido.` 
      });
    }

    const novoCv = new CV({ ...req.body, userId: req.user.id });
    await novoCv.save();
    res.status(201).json(novoCv);
  } catch (err) {
    res.status(500).send("Erro ao criar.");
  }
});