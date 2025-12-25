import { useState, useEffect } from 'react';
import api from '../services/api';
import MealCard from '../components/MealCard';

function Dashboard() {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [meals, setMeals] = useState({});
    const [dailyTotals, setDailyTotals] = useState({
        calories: 0,
        carbohydrates: 0,
        protein: 0,
        fats: 0
    });
    const [goals, setGoals] = useState({
        calories: 2000,
        protein: 150,
        carbohydrates: 250,
        fats: 65
    });
    const [loading, setLoading] = useState(true);

    // Load goals from API
    useEffect(() => {
        loadGoals();
    }, []);

    // Load meals when date changes
    useEffect(() => {
        loadMeals();
    }, [date]);

    const loadGoals = async () => {
        try {
            const data = await api.getUserGoals();
            setGoals(data);
        } catch (error) {
            console.error('Error loading goals:', error);
        }
    };

    const loadMeals = async () => {
        try {
            setLoading(true);
            const data = await api.getMeals(date);
            setMeals(data.dailyMeals);
            setDailyTotals(data.dailyTotals);
        } catch (error) {
            console.error('Error loading meals:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculatePercentage = (actual, goal) => {
        return goal > 0 ? Math.round((actual / goal) * 100) : 0;
    };

    // Get greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    // Calculate gauge values
    const caloriesPercent = calculatePercentage(dailyTotals.calories, goals.calories);
    const circumference = 377; // Approximate half-circle circumference for r=120
    const strokeDashoffset = circumference - (Math.min(caloriesPercent, 100) / 100) * circumference;
    const caloriesRemaining = Math.max(goals.calories - dailyTotals.calories, 0);

    if (loading) return (
        <div className="loading-container">
            <div className="loading-spinner"></div>
        </div>
    );

    return (
        <div className="dashboard fade-in">
            {/* Header */}
            <div className="dashboard-header">
                <div className="dashboard-greeting">
                    <h1>{getGreeting()}! 👋</h1>
                    <p>Let's check your nutrition progress</p>
                </div>
                <input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)}
                />
            </div>

            {/* Hero Calorie Gauge */}
            <div className="daily-summary">
                <div className="gauge-container">
                    <div className="calorie-gauge">
                        <svg width="260" height="140" viewBox="0 0 260 140">
                            <defs>
                                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#4ade80" />
                                    <stop offset="50%" stopColor="#22c55e" />
                                    <stop offset="100%" stopColor="#16a34a" />
                                </linearGradient>
                            </defs>
                            {/* Background arc */}
                            <path 
                                className="gauge-bg" 
                                d="M 10 130 A 120 120 0 0 1 250 130" 
                            />
                            {/* Progress arc */}
                            <path 
                                className="gauge-progress" 
                                d="M 10 130 A 120 120 0 0 1 250 130"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                            />
                        </svg>
                        <div className="gauge-center">
                            <div className="gauge-calories">{dailyTotals.calories.toFixed(0)}</div>
                            <div className="gauge-goal">of {goals.calories} kcal</div>
                        </div>
                    </div>
                    
                    <div className="gauge-stats">
                        <div className="stat-card">
                            <div className="stat-value">{caloriesRemaining.toFixed(0)}</div>
                            <div className="stat-label">Remaining</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{caloriesPercent}%</div>
                            <div className="stat-label">Daily Goal</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Macro Progress Bars */}
            <div className="macro-progress">
                <div className="macro-progress-title">Macronutrients</div>
                <div className="macro-bars">
                    {/* Protein */}
                    <div className="macro-bar-item">
                        <div className="macro-bar-label">
                            <span className="macro-dot protein"></span>
                            <span>Protein</span>
                        </div>
                        <div className="macro-bar-track">
                            <div 
                                className="macro-bar-fill protein" 
                                style={{ width: `${Math.min(calculatePercentage(dailyTotals.protein, goals.protein), 100)}%` }}
                            ></div>
                        </div>
                        <div className="macro-bar-values">
                            <strong>{dailyTotals.protein.toFixed(0)}g</strong> / {goals.protein}g
                        </div>
                    </div>

                    {/* Carbs */}
                    <div className="macro-bar-item">
                        <div className="macro-bar-label">
                            <span className="macro-dot carbs"></span>
                            <span>Carbs</span>
                        </div>
                        <div className="macro-bar-track">
                            <div 
                                className="macro-bar-fill carbs" 
                                style={{ width: `${Math.min(calculatePercentage(dailyTotals.carbohydrates, goals.carbohydrates), 100)}%` }}
                            ></div>
                        </div>
                        <div className="macro-bar-values">
                            <strong>{dailyTotals.carbohydrates.toFixed(0)}g</strong> / {goals.carbohydrates}g
                        </div>
                    </div>

                    {/* Fats */}
                    <div className="macro-bar-item">
                        <div className="macro-bar-label">
                            <span className="macro-dot fats"></span>
                            <span>Fats</span>
                        </div>
                        <div className="macro-bar-track">
                            <div 
                                className="macro-bar-fill fats" 
                                style={{ width: `${Math.min(calculatePercentage(dailyTotals.fats, goals.fats), 100)}%` }}
                            ></div>
                        </div>
                        <div className="macro-bar-values">
                            <strong>{dailyTotals.fats.toFixed(0)}g</strong> / {goals.fats}g
                        </div>
                    </div>
                </div>
            </div>

            {/* Meals Section */}
            <div className="meals-section-title">Today's Meals</div>
            <div className="meals-container">
                {Object.values(meals).map(meal => (
                    <MealCard 
                        key={meal.id} 
                        meal={meal}
                        onFoodDeleted={loadMeals}
                    />
                ))}
            </div>
        </div>
    );
}

export default Dashboard;
