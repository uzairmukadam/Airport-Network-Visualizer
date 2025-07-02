import pandas as pd

def clean_csv(file_path, output_path):
    try:
        data = pd.read_csv(file_path)
        print("Original Data:")
        print(data.head())

        data = data.dropna()
        print("\nAfter removing rows with missing values:")
        print(data.head())

        if 'IATA' in data.columns:
            data = data[data['IATA'] != '\\N']
            print("\nAfter dropping rows with 'iata' column value as '\\N':")
            print(data.tail())
        else:
            print("\nColumn 'iata' not found in the dataset.")

        data = data.drop_duplicates()
        print("\nAfter removing duplicates:")
        print(data.head())

        data.to_csv(output_path, index=False)
        print(f"\nCleaned data saved to {output_path}")

    except Exception as e:
        print(f"Error: {e}")

clean_csv('data/airports.csv', 'cleaned_dataset.csv')
