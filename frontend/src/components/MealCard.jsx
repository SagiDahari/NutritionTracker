import { useState } from 'react'
import FoodItem from './FoodItem'
import AddFoodForm from './AddFoodForm'

// Meal type to icon mapping
const mealIcons = {
    'breakfast': '🌅',
    'lunch': '☀️',
    'dinner': '🌙',
    'snack': '🍿'
};

function MealCard(props) {
    const { meal, onFoodDeleted } = props;
    const [showAddForm, setShowAddForm] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const handleFoodAdded = () => {
        setShowAddForm(false);
        onFoodDeleted(); // Refresh meals
    };

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    const foodCount = Object.keys(meal.foods).length;
    const icon = mealIcons[meal.type] || '🍽️';

    return (
        <div className={`meal-card ${isExpanded ? 'expanded' : ''}`}>
            {/* Meal Header - Clickable to expand/collapse */}
            <div className="meal-header" onClick={toggleExpand}>
                <div className="meal-header-left">
                    <span className="meal-icon">{icon}</span>
                    <div className="meal-info">
                        <h3>{meal.type}</h3>
                        <p>{foodCount} {foodCount === 1 ? 'item' : 'items'}</p>
                    </div>
                </div>
                
                <div className="meal-header-right">
                    <div className="meal-totals">
                        <span className="meal-calories">{meal.totals.calories.toFixed(0)} cal</span>
                        <span className="meal-macros-summary">
                            P: {meal.totals.protein.toFixed(0)}g • C: {meal.totals.carbohydrates.toFixed(0)}g • F: {meal.totals.fats.toFixed(0)}g
                        </span>
                    </div>
                    <svg 
                        className="expand-icon" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M19 9l-7 7-7-7" 
                        />
                    </svg>
                </div>
            </div>

            {/* Expandable Content */}
            {isExpanded && (
                <div className="meal-content">
                    <div className="foods-list">
                        {foodCount !== 0 ? (
                            Object.values(meal.foods).map(food => (
                                <FoodItem 
                                    key={food.fdcId}
                                    food={food}
                                    mealId={meal.id}
                                    onDelete={onFoodDeleted}
                                />
                            ))
                        ) : (
                            <p>No foods logged yet</p>
                        )}
                    </div>
                    
                    {!showAddForm ? (
                        <button 
                            className="add-food-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowAddForm(true);
                            }}
                        >
                            + Add Food
                        </button>
                    ) : (
                        <AddFoodForm
                            mealId={meal.id}
                            onFoodAdded={handleFoodAdded}
                            onCancel={() => setShowAddForm(false)}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

export default MealCard;