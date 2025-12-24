import { db } from '../config/database.js';

export const getUserGoals = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT calories, protein, carbohydrates, fats FROM user_goals WHERE user_id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      // Create default goals if they don't exist
      await db.query('INSERT INTO user_goals (user_id) VALUES ($1)', [
        req.user.userId,
      ]);
      return res.json({
        calories: 2000,
        protein: 150,
        carbohydrates: 250,
        fats: 65,
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'Failed to get goals' });
  }
};

export const updateUserGoals = async (req, res) => {
  try {
    const { calories, protein, carbohydrates, fats } = req.body;

    await db.query(
      `UPDATE user_goals 
       SET calories = $1, protein = $2, carbohydrates = $3, fats = $4, updated_at = NOW()
       WHERE user_id = $5`,
      [calories, protein, carbohydrates, fats, req.user.userId]
    );

    res.json({
      message: 'Goals updated successfully',
      goals: { calories, protein, carbohydrates, fats },
    });
  } catch (error) {
    console.error('Update goals error:', error);
    res.status(500).json({ error: 'Failed to update goals' });
  }
};
