import api from '../services/api'

function FoodItem(props) {

    const {food, mealId, onDelete} = props;

    const handleDelete = async () => {
        try {
            await api.deleteFood(mealId, food.fdcId);
            onDelete();
        } catch (error) {
            console.error('Error deleting food:', error);
        }
    };

  
    return (
        <div className="food-item">
      <div className="food-info">
        <h4>{food.description}</h4>
        {food.brand && <span className="brand">{food.brand}</span>}
        <span className="quantity">{food.quantity}g</span>
      </div>

      <div className="food-macros">
        <span>{food.calories.toFixed(0)} cal</span>
        <span> C: {food.carbohydrates.toFixed(1)}g</span>
        <span> P: {food.protein.toFixed(1)}g</span>
        <span> F: {food.fats.toFixed(1)}g</span>
      </div>

      <button className="delete-btn" onClick={handleDelete}>
        🗑️
      </button>
    </div>
    )

}

export default FoodItem;
