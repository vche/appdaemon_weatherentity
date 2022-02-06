// Base weather widget allowing to get whether from a weather entitied in addition to sensors.
// Also adds serveral days/hours of forecast.
// Fully compliant with the official base widget.
// Note: For 2x2 widget, only 1 forecqst should be used. Up to for can be used in 3x2.
//
// ex:
// openweathermap:
//   title: Now
//   widget_type: weatherentity
//   entity: weather.openweathermap
//   show_forecast: 4
//   prefer_icons: 1
//   # Units as configured in homeassistant
//   units: "&deg;C"
//   wind_unit: "km/h"
//   pressure_unit: "hPa"
//   rain_unit: "%"
//
// layout:
//     - label(2x2),openweathermap(3x2)
//
// Based on the appdaemon weather widget:
// https://github.com/AppDaemon/appdaemon/blob/dev/appdaemon/widgets/baseweather/baseweather.js
//

function OnStateAvailable(self, state)
{
    self.state = state.state;
}

function base_weatherentity(widget_id, url, skin, parameters)
{
    // Will be using "self" throughout for the various flavors of "this"
    // so for consistency ...
    self = this;

    // Initialization
    self.widget_id = widget_id;

    // Parameters may come in useful later on
    self.parameters = parameters;

    var callbacks = [];
    // Define callbacks for entities - this model allows a widget to monitor multiple entities if needed
    // Initial will be called when the dashboard loads and state has been gathered for the entity
    // Update will be called every time an update occurs for that entity
    self.OnStateAvailable = OnStateAvailable;
    self.OnStateUpdate = OnStateUpdate;

    var monitored_entities = []

    self.show_forecast = parameters.show_forecast;
    self.daily_mode = parameters.forecast_daily;
    // If entity is specified, we are monitoring a weather entity
    if ("entity" in parameters)
    {
        self.sensor_monitoring = false;
        var monitored_entities = [
            {"entity": parameters.entity, "initial": self.OnStateAvailable, "update": self.OnStateUpdate}
        ]
    }
    else if ("entities" in parameters)
    {
        self.sensor_monitoring = true;
        // Map will be used to know what field are we going to update from what sensor
        self.entities_map = {}

        // If entities are specified, we are monitoring a set of sensors
        var entities = $.extend({}, parameters.entities, parameters.sensors);
        for (var key in entities)
        {
            var entity = entities[key]
            if (entity != '' && check_if_forecast_sensor(parameters.show_forecast, entity))
            {
                monitored_entities.push({
                    "entity": entity, "initial": self.OnStateAvailable, "update": self.OnStateUpdate
                })
                self.entities_map[entity] = key
            }
        }
    }
    else
    {
        console.log("Missing entity or entities definition in weather widget");
    }

    // If forecast is disabled - don't monitor the forecast sensors
    function check_if_forecast_sensor(show_forecast, entity)
    {
        if (show_forecast)
        {
          return true
        }
        else if(entity.substring(entity.length - 2) === "_1")
        {
          return false
        }
        else
        {
          return true
        }
    }

    // Finally, call the parent constructor to get things moving
    WidgetBase.call(self, widget_id, url, skin, parameters, monitored_entities, callbacks);

    // Function Definitions

    // The OnStateAvailable function will be called when
    // self.state[<entity>] has valid information for the requested entity
    // state is the initial state
    // Methods
    function OnStateUpdate(self, state)
    {
        set_view(self, state)
    }

    function OnStateAvailable(self, state)
    {
        // Init the units if sensors are used. not sent when using entity.
        if (self.sensor_monitoring)
        {
            field = self.entities_map[state.entity_id]
            if (field == 'temperature')
            {
                self.set_field(self, "unit", state.attributes.unit_of_measurement)
            }
            else if (field == 'wind_speed')
            {
                self.set_field(self, "wind_unit", state.attributes.unit_of_measurement)
            }
            else if (field == 'pressure')
            {
                self.set_field(self, "pressure_unit", state.attributes.unit_of_measurement)
            }
            else if (field == 'precip_intensity')
            {
                self.set_field(self, "rain_unit", state.attributes.unit_of_measurement)
            }
        }
        set_view(self, state)
    }

    function compute_icon_rotation(bearing)
    {
        var counts = [45, 90, 135, 180, 225, 270, 315]
        var goal = (parseInt(bearing) + 270) % 360
        var closest = counts.reduce(function(prev, curr) {
              return (Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev);
        });
        return closest;
    }

    function get_weather_icon(condition)
    {
        // Map weather condition/states with their mdi name. Defaults to the same
        var icon_map = {'partlycloudy':'partly-cloudy'}
        return "mdi mdi-weather-" + (icon_map[condition] || condition);
    }

    // Set the view when data are coming from multiple sensors
    function set_view_from_sensors(self, state)
    {
        field = self.entities_map[state.entity_id]
        if (field)
        {
            if (field == 'icon' || field == 'forecast_icon')
            {
                self.set_field(self, field, state.state)
                return
            }

            if (field == 'precip_type')
            {
                self.set_field(self, "precip_type_icon", self.parameters.icons[state.state])
            }
            else if (field == 'forecast_precip_type')
            {
                self.set_field(self, "forecast_precip_type_icon", self.parameters.icons[state.state])
            }
            else if (field == 'wind_bearing')
            {
                self.set_field(self, "bearing_icon", "mdi-rotate-" + compute_icon_rotation(state.state))
            }
            self.set_field(self, field, self.format_number(self, state.state))
        }
    }

    // Set the view when data are coming from a single weather entity
    function set_view_from_entity(self, state)
    {
        // Setbearing icons
        self.set_field(self, "bearing_icon", "mdi-rotate-" + compute_icon_rotation(state.attributes.wind_bearing));
        self.set_field(self, "icon", get_weather_icon(state.state));

        // Set measures
        self.set_field(self, "temperature", self.format_number(self, state.attributes.temperature));
        self.set_field(self, "pressure", self.format_number(self, state.attributes.pressure));
        self.set_field(self, "humidity", self.format_number(self, state.attributes.humidity));
        self.set_field(self, "wind_speed", self.format_number(self, state.attributes.wind_speed));
        self.set_field(self, "wind_bearing", self.format_number(self, state.attributes.wind_bearing));

        // As per https://github.com/home-assistant/core/blob/dev/homeassistant/components/weather/__init__.py
        // those fields are not provided by the weather entities:
        // precip_probability, precip_intensity, precip_type,

        // forecast_temperature_min: forecast.templow If daily mode only
        if (self.show_forecast)
        {
            // Display required forecast count
            fc_available = Object.keys(state.attributes.forecast).length
            fc_max = (self.show_forecast > fc_available)?fc_available:self.show_forecast;
            for (idx = 0; idx < fc_max; idx++)
            {
                attr_suffix = (idx > 0)?idx+1:"";
                forecast = state.attributes.forecast[idx];
                evt_datetime = new Date(forecast.datetime);
                self.set_field(self, "forecast_icon"+attr_suffix, get_weather_icon(forecast.condition));
                self.set_field(self, "forecast_precip_probability"+attr_suffix, forecast.precipitation.toFixed(2));

                if (self.daily_mode)
                {
                    fc_title = "" + (evt_datetime.getMonth() + 1) + "/" + evt_datetime.getDate();
                    self.set_field(self, "forecast_title"+attr_suffix, fc_title);
                    self.set_field(self, "forecast_temperature_min"+attr_suffix, self.format_number(self, forecast.templow));
                    self.set_field(self, "forecast_temperature_max"+attr_suffix, self.format_number(self, forecast.temperature));
                }
                else
                {
                    fc_title = evt_datetime.getHours() + "h";
                    self.set_field(self, "forecast_title"+attr_suffix, fc_title);
                    self.set_field(self, "forecast_temperature_min"+attr_suffix, self.format_number(self, forecast.temperature));
                }
            }
        }
    }

    function set_view(self, state)
    {
        if (self.sensor_monitoring)
        {
            set_view_from_sensors(self, state);
        }
        else
        {
            set_view_from_entity(self, state);
        }
    }
}
